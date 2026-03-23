#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────
# HoneyCloud — Collector Service
# Tails cowrie.json → scores each event → writes to PostgreSQL
#
# Usage:
#   python -m honeycloud.collector                  # production
#   python -m honeycloud.collector --mock           # local test
#   python -m honeycloud.collector --db-url <url>   # custom DB
#   python -m honeycloud.collector --from-start     # reprocess entire file
# ─────────────────────────────────────────────────────────────

import os
import time
import json
import argparse
import logging
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("honeycloud.collector")

# ─────────────────────────────────────────────
#  Default paths
# ─────────────────────────────────────────────
DEFAULT_LOG_CANDIDATES = [
    "/opt/cowrie/var/log/cowrie/cowrie.json",   # Oracle VM path
    "data/cowrie-logs/cowrie.json",              # local dev path (volume mount root)
    "data/cowrie-logs/cowrie/cowrie.json",       # local alt path
]

DEFAULT_DB_URL = os.environ.get(
    "HONEYCLOUD_DB_URL",
    "postgresql://honeycloud:honeycloud@localhost:5432/honeycloud"
)

# ─────────────────────────────────────────────
#  DB schema — run once on startup
# ─────────────────────────────────────────────
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS attacks (
    id              SERIAL PRIMARY KEY,
    src_ip          TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    event_type      TEXT NOT NULL,
    username        TEXT,
    password        TEXT,
    command         TEXT,
    session_id      TEXT,
    mitre_id        TEXT,
    mitre_name      TEXT,
    severity        TEXT,
    attack_type     TEXT,
    anomaly_score   FLOAT,
    next_move_1     TEXT,
    next_move_1_prob FLOAT,
    next_move_2     TEXT,
    next_move_2_prob FLOAT,
    honeypot        TEXT DEFAULT 'cowrie',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    session_id      TEXT UNIQUE NOT NULL,
    src_ip          TEXT NOT NULL,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    duration_sec    FLOAT,
    login_attempts  INT DEFAULT 0,
    login_successes INT DEFAULT 0,
    commands_run    INT DEFAULT 0,
    credentials     JSONB DEFAULT '[]',
    commands        JSONB DEFAULT '[]',
    hassh           TEXT,
    honeypot        TEXT DEFAULT 'cowrie',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flows (
    id              SERIAL PRIMARY KEY,
    src_ip          TEXT NOT NULL,
    session_id      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL,
    dst_port        INT,
    src_port        INT,
    protocol        INT,
    packet_count    INT,
    total_bytes     INT,
    flow_duration_sec FLOAT,
    syn_ratio       FLOAT,
    rst_ratio       FLOAT,
    attack_type     TEXT,
    anomaly_score   FLOAT,
    honeypot        TEXT DEFAULT 'cowrie',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attacks_src_ip    ON attacks(src_ip);
CREATE INDEX IF NOT EXISTS idx_attacks_timestamp ON attacks(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_src_ip   ON sessions(src_ip);
CREATE INDEX IF NOT EXISTS idx_flows_src_ip      ON flows(src_ip);
"""


# ─────────────────────────────────────────────
#  DB connection
# ─────────────────────────────────────────────
def _connect(db_url: str):
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        return conn
    except ImportError:
        log.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        raise
    except Exception as e:
        log.error(f"DB connection failed: {e}")
        raise


def _ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
    log.info("✅ Schema ready")


# ─────────────────────────────────────────────
#  Score an event via honeycloud score pipeline
# ─────────────────────────────────────────────
def _score_ip(ip: str) -> dict:
    """Run the full ML pipeline on an IP. Returns scoring dict."""
    try:
        from honeycloud.score import _load_models, _build_feature_vector, \
                                     _features_to_array, _CACHE
        import numpy as np

        if not _load_models():
            return {}

        features = _build_feature_vector(ip)
        X        = _features_to_array(features)

        # Isolation Forest
        raw           = _CACHE["iso"].decision_function(X)[0]
        anomaly_score = float(np.clip(0.5 - raw, 0.0, 1.0))

        # XGBoost + RF ensemble
        xgb_p      = _CACHE["xgb"].predict_proba(X)[0]
        rf_p       = _CACHE["rf"].predict_proba(X)[0]
        ensemble   = (xgb_p + rf_p) / 2
        pred_idx   = int(np.argmax(ensemble))
        attack_type = _CACHE["le"].inverse_transform([pred_idx])[0]

        # Bi-LSTM next move
        next_moves = []
        if _CACHE.get("lstm") is not None:
            feat_cols = _CACHE["feature_cols"]
            single    = np.array([features.get(c, 0.0) for c in feat_cols],
                                 dtype=np.float32)
            X_seq     = _CACHE["lstm_scaler"].transform(
                            np.tile(single, (5, 1))
                        ).reshape(1, 5, len(feat_cols)).astype(np.float32)
            sess      = _CACHE["lstm"]
            inp_name  = sess.get_inputs()[0].name
            probs     = sess.run(None, {inp_name: X_seq})[0][0]
            top2      = np.argsort(probs)[::-1][:2]
            classes   = _CACHE["lstm_le"].classes_
            next_moves = [(classes[i], float(probs[i])) for i in top2]

        return {
            "anomaly_score"   : anomaly_score,
            "attack_type"     : attack_type,
            "next_move_1"     : next_moves[0][0] if len(next_moves) > 0 else None,
            "next_move_1_prob": next_moves[0][1] if len(next_moves) > 0 else None,
            "next_move_2"     : next_moves[1][0] if len(next_moves) > 1 else None,
            "next_move_2_prob": next_moves[1][1] if len(next_moves) > 1 else None,
        }

    except Exception as e:
        log.warning(f"Scoring failed for {ip}: {e}")
        return {}


# ─────────────────────────────────────────────
#  Parse a single cowrie JSON event
# ─────────────────────────────────────────────
def _parse_event(line: str) -> dict | None:
    line = line.strip()
    if not line:
        return None
    # strip docker log prefix if present
    if line.startswith("20") and " " in line[:35]:
        parts = line.split(" ", 1)
        if len(parts) == 2:
            line = parts[1].strip()
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def _map_severity(eid: str, cmd: str = "") -> str:
    if eid == "cowrie.login.success":
        return "HIGH"
    if eid == "cowrie.login.failed":
        return "MEDIUM"
    if eid == "cowrie.command.input":
        critical = ["wget", "curl", "chmod +x", "python", "perl", "nc ", "bash -i"]
        if any(x in cmd for x in critical):
            return "CRITICAL"
        return "HIGH"
    return "LOW"


# ─────────────────────────────────────────────
#  Write event to DB
# ─────────────────────────────────────────────
def _insert_attack(conn, event: dict, scoring: dict):
    eid     = event.get("eventid", "")
    src_ip  = event.get("src_ip", "unknown")
    ts      = event.get("timestamp", datetime.now(timezone.utc).isoformat())
    session = event.get("session", "")
    cmd     = event.get("input", "") if eid == "cowrie.command.input" else ""

    mitre_map = {
        "cowrie.login.success" : ("T1110.001", "Brute Force: Password Guessing"),
        "cowrie.login.failed"  : ("T1110.001", "Brute Force: Password Guessing"),
        "cowrie.session.connect": ("T1190",    "Exploit Public-Facing Application"),
    }
    mitre_id, mitre_name = mitre_map.get(eid, ("T1059", "Command and Scripting Interpreter"))

    event_type_map = {
        "cowrie.login.success"  : "login_success",
        "cowrie.login.failed"   : "login_failed",
        "cowrie.command.input"  : "command",
        "cowrie.session.connect": "connect",
        "cowrie.session.closed" : "disconnect",
    }
    event_type = event_type_map.get(eid, eid)

    sql = """
        INSERT INTO attacks (
            src_ip, timestamp, event_type, username, password,
            command, session_id, mitre_id, mitre_name, severity,
            attack_type, anomaly_score,
            next_move_1, next_move_1_prob,
            next_move_2, next_move_2_prob
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s,
            %s, %s,
            %s, %s
        )
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            src_ip, ts, event_type,
            event.get("username"), event.get("password"),
            cmd or None, session, mitre_id, mitre_name,
            _map_severity(eid, cmd),
            scoring.get("attack_type"),
            scoring.get("anomaly_score"),
            scoring.get("next_move_1"),
            scoring.get("next_move_1_prob"),
            scoring.get("next_move_2"),
            scoring.get("next_move_2_prob"),
        ))


def _upsert_session(conn, event: dict, session_state: dict):
    """Keep sessions table in sync."""
    eid     = event.get("eventid", "")
    session = event.get("session", "")
    src_ip  = event.get("src_ip", "unknown")
    ts      = event.get("timestamp", "")

    if not session:
        return

    state = session_state.setdefault(session, {
        "src_ip"          : src_ip,
        "start_time"      : ts,
        "login_attempts"  : 0,
        "login_successes" : 0,
        "commands_run"    : 0,
        "credentials"     : [],
        "commands"        : [],
        "hassh"           : None,
    })

    if eid == "cowrie.login.failed":
        state["login_attempts"] += 1
    elif eid == "cowrie.login.success":
        state["login_attempts"] += 1
        state["login_successes"] += 1
        state["credentials"].append({
            "username": event.get("username"),
            "password": event.get("password"),
        })
    elif eid == "cowrie.command.input":
        state["commands_run"] += 1
        state["commands"].append(event.get("input", ""))
    elif eid == "cowrie.client.kex":
        state["hassh"] = event.get("hassh")
    elif eid == "cowrie.session.closed":
        state["end_time"]     = ts
        state["duration_sec"] = float(event.get("duration", 0))

    sql = """
        INSERT INTO sessions (
            session_id, src_ip, start_time, end_time, duration_sec,
            login_attempts, login_successes, commands_run,
            credentials, commands, hassh
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (session_id) DO UPDATE SET
            end_time        = EXCLUDED.end_time,
            duration_sec    = EXCLUDED.duration_sec,
            login_attempts  = EXCLUDED.login_attempts,
            login_successes = EXCLUDED.login_successes,
            commands_run    = EXCLUDED.commands_run,
            credentials     = EXCLUDED.credentials,
            commands        = EXCLUDED.commands,
            hassh           = EXCLUDED.hassh
    """
    import json as _json
    with conn.cursor() as cur:
        cur.execute(sql, (
            session, state["src_ip"],
            state.get("start_time"), state.get("end_time"),
            state.get("duration_sec"),
            state["login_attempts"], state["login_successes"],
            state["commands_run"],
            _json.dumps(state["credentials"]),
            _json.dumps(state["commands"]),
            state.get("hassh"),
        ))


# ─────────────────────────────────────────────
#  Score cache
# ─────────────────────────────────────────────
_score_cache: dict = {}

def _get_score(ip: str) -> dict:
    if ip not in _score_cache:
        _score_cache[ip] = _score_ip(ip)
    return _score_cache[ip]


# ─────────────────────────────────────────────
#  Main tail loop
# ─────────────────────────────────────────────
INTERESTING_EVENTS = {
    "cowrie.session.connect",
    "cowrie.login.failed",
    "cowrie.login.success",
    "cowrie.command.input",
    "cowrie.session.closed",
    "cowrie.client.kex",
}

# How often to print the heartbeat when idle (seconds)
HEARTBEAT_INTERVAL = 30


def tail_and_collect(log_path: str, conn, dry_run: bool = False,
                     from_start: bool = False):
    """
    Tail cowrie.json and process new lines as they arrive.

    FIX vs original:
    - Tracks the current read position explicitly (last_pos) instead of
      relying on readline() blocking behaviour, which missed lines when
      Cowrie flushed late or the file was written in bursts.
    - Detects file rotation: if the file shrinks (inode replaced) the
      handle is reopened from the start of the new file.
    - Heartbeat log every HEARTBEAT_INTERVAL seconds so you can confirm
      the collector is alive even when no events are arriving.
    - --from-start flag to reprocess the entire existing file on startup
      (useful for debugging; omit in production).
    """
    log.info(f"📂 Tailing: {log_path}")
    log.info(f"💾 DB write: {'disabled (dry run)' if dry_run else 'enabled'}")
    if from_start:
        log.info("⏪ --from-start: reprocessing entire file")

    session_state: dict  = {}
    events_processed     = 0
    events_written       = 0
    last_heartbeat       = time.time()

    def _open_file(seek_end: bool):
        f = open(log_path, "r")
        if seek_end:
            f.seek(0, 2)          # jump to EOF
        pos = f.tell()
        inode = os.fstat(f.fileno()).st_ino
        log.info(f"✅ Collector running — watching from byte {pos} "
                 f"(inode {inode})")
        return f, pos, inode

    f, last_pos, current_inode = _open_file(seek_end=not from_start)

    try:
        while True:
            # ── rotation check ──────────────────────────────────────────
            # If the file on disk has a different inode (logrotate / Cowrie
            # restart), reopen it from the beginning.
            try:
                disk_inode = os.stat(log_path).st_ino
                if disk_inode != current_inode:
                    log.info("🔄 File rotated — reopening")
                    f.close()
                    f, last_pos, current_inode = _open_file(seek_end=False)
            except FileNotFoundError:
                # file temporarily missing during rotation — wait and retry
                time.sleep(1)
                continue

            # ── read new content ────────────────────────────────────────
            # Seek to last known position first. This is the key fix:
            # readline() on a file that hasn't grown returns "" immediately,
            # so without re-seeking we'd drift or miss content written
            # between polls.
            f.seek(last_pos)
            new_content = f.read()          # read everything since last_pos

            if new_content:
                last_pos = f.tell()         # advance our bookmark
                lines = new_content.splitlines()

                for line in lines:
                    event = _parse_event(line)
                    if not event:
                        continue

                    eid = event.get("eventid", "")
                    if eid not in INTERESTING_EVENTS:
                        continue

                    events_processed += 1
                    src_ip = event.get("src_ip", "unknown")
                    scoring = _get_score(src_ip)

                    if dry_run:
                        ts = event.get("timestamp", "")[:19]
                        score_str = (
                            f"score={scoring.get('anomaly_score', 0):.2f}"
                            f"  type={scoring.get('attack_type', '?')}"
                            if scoring else "(no scoring)"
                        )
                        log.info(f"  {ts}  {eid:<30}  {src_ip:<18}  {score_str}")
                    else:
                        try:
                            _insert_attack(conn, event, scoring)
                            _upsert_session(conn, event, session_state)
                            events_written += 1
                            log.info(
                                f"✍️  {eid:<30}  {src_ip:<18}"
                                f"  score={scoring.get('anomaly_score', 0):.2f}"
                                f"  type={scoring.get('attack_type', '?')}"
                            )
                        except Exception as e:
                            log.error(f"DB write failed: {e}")

                    if events_processed % 100 == 0:
                        log.info(
                            f"📊 Processed: {events_processed}  "
                            f"Written: {events_written}"
                        )
            else:
                # No new content — sleep briefly before next poll
                time.sleep(0.5)

            # ── heartbeat ───────────────────────────────────────────────
            now = time.time()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                log.info(
                    f"💓 Alive — processed={events_processed}  "
                    f"written={events_written}  "
                    f"watching_byte={last_pos}"
                )
                last_heartbeat = now

    finally:
        f.close()


# ─────────────────────────────────────────────
#  Wait for log file
# ─────────────────────────────────────────────
def _wait_for_log_file(candidates: list, explicit_path: str = None, 
                       timeout: int = 60) -> str | None:
    """
    Wait for log file to appear, with retries.
    
    Args:
        candidates: list of paths to check
        explicit_path: if provided, only wait for this path
        timeout: max seconds to wait (default 60)
    
    Returns:
        path to log file if found, None if timeout
    """
    if explicit_path:
        paths_to_check = [explicit_path]
    else:
        paths_to_check = candidates
    
    start = time.time()
    attempt = 0
    
    while time.time() - start < timeout:
        attempt += 1
        
        # Check each candidate
        for candidate in paths_to_check:
            if os.path.exists(candidate):
                log.info(f"✅ Found log file: {candidate}")
                return candidate
        
        elapsed = int(time.time() - start)
        if attempt % 10 == 1:  # Log every ~10 seconds
            log.info(f"⏳ Waiting for cowrie.json... ({elapsed}s elapsed, {timeout - elapsed}s remaining)")
        
        time.sleep(1)
    
    return None


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="HoneyCloud Collector")
    parser.add_argument("--log-path",   help="Path to cowrie.json")
    parser.add_argument("--db-url",     default=DEFAULT_DB_URL,
                        help="PostgreSQL URL")
    parser.add_argument("--dry-run",    action="store_true",
                        help="Print events without writing to DB")
    parser.add_argument("--from-start", action="store_true",
                        help="Reprocess the entire existing log file on startup")
    args = parser.parse_args()

    # find log file (with wait for it to be created)
    log_path = args.log_path
    if not log_path:
        log_path = _wait_for_log_file(DEFAULT_LOG_CANDIDATES, explicit_path=None, timeout=60)
    else:
        # Even if explicit path is given, wait for it to exist
        log_path = _wait_for_log_file(DEFAULT_LOG_CANDIDATES, explicit_path=log_path, timeout=60)
    
    if not log_path:
        log.error(
            "cowrie.json not found after waiting 60 seconds. Check that Cowrie is running "
            "and writing to the log file."
        )
        return

    if args.dry_run:
        log.info("🧪 Dry run mode — no DB writes")
        tail_and_collect(log_path, conn=None, dry_run=True,
                         from_start=args.from_start)
        return

    log.info("🔌 Connecting to DB...")
    conn = _connect(args.db_url)
    _ensure_schema(conn)

    try:
        tail_and_collect(log_path, conn, dry_run=False,
                         from_start=args.from_start)
    except KeyboardInterrupt:
        log.info("Collector stopped.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()