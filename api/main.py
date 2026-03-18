"""
HoneyCloud — FastAPI Backend
api/main.py

Run from project root:
    uvicorn api.main:app --reload --port 8000

Endpoints:
    GET  /api/health
    GET  /api/attacks/live          ?limit=50
    GET  /api/attacks/stats
    GET  /api/sessions              ?limit=20
    GET  /api/sessions/{session_id}
    GET  /api/score/{ip}
    GET  /api/top-ips               ?limit=10
    WS   /ws/live
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

# ── Allow `from honeycloud.score import ...` when running from project root ──
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HoneyCloud API",
    description="Threat intelligence API for the HoneyCloud honeypot platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten this when you have a real frontend domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB config ─────────────────────────────────────────────────────────────────
DB_URL = os.environ.get(
    "HONEYCLOUD_DB_URL",
    "postgresql://honeycloud:honeycloud@localhost:5432/honeycloud",
)


def _get_conn():
    """Return a new psycopg2 connection with RealDictCursor."""
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── WebSocket broadcast hub ───────────────────────────────────────────────────
class _Hub:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self._clients.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self._clients:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.remove(ws)


hub = _Hub()


# ── Score cache (avoid re-running ML for the same IP within a session) ────────
_score_cache: dict[str, dict] = {}


def _score_ip(ip: str) -> dict:
    """Run the full ML pipeline on an IP and return a plain dict."""
    if ip in _score_cache:
        return _score_cache[ip]

    # Import lazily so startup is fast if models aren't needed yet
    import numpy as np
    import warnings
    warnings.filterwarnings("ignore")

    # Reuse the internals of honeycloud.score directly
    from honeycloud.score import (
        _load_models, _build_feature_vector, _features_to_array,
        _threat_label, KNOWN_MALICIOUS, MITRE_MAP, _CACHE,
    )

    _load_models()

    features = _build_feature_vector(ip)
    X = _features_to_array(features)

    # Isolation Forest
    raw_score = _CACHE["iso"].decision_function(X)[0]
    anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

    # XGBoost + RF ensemble
    xgb_probs  = _CACHE["xgb"].predict_proba(X)[0]
    rf_probs   = _CACHE["rf"].predict_proba(X)[0]
    ensemble   = (xgb_probs + rf_probs) / 2
    pred_idx   = int(np.argmax(ensemble))
    confidence = float(ensemble[pred_idx])
    attack_type = _CACHE["le"].inverse_transform([pred_idx])[0]

    # Bi-LSTM next move
    next_moves: list[dict] = []
    if _CACHE.get("lstm") is not None:
        try:
            SEQ_LEN   = 5
            feat_cols = _CACHE["feature_cols"]
            single    = np.array([features.get(c, 0.0) for c in feat_cols],
                                 dtype=np.float32)
            X_seq = _CACHE["lstm_scaler"].transform(
                        np.tile(single, (SEQ_LEN, 1))
                    ).reshape(1, SEQ_LEN, len(feat_cols)).astype(np.float32)
            sess      = _CACHE["lstm"]
            inp_name  = sess.get_inputs()[0].name
            probs     = sess.run(None, {inp_name: X_seq})[0][0]
            top2_idx  = np.argsort(probs)[::-1][:2]
            classes   = _CACHE["lstm_le"].classes_
            next_moves = [
                {"attack_type": classes[i], "probability": float(probs[i])}
                for i in top2_idx
            ]
        except Exception:
            pass

    # Adjust for known-malicious IPs and private ranges
    known = KNOWN_MALICIOUS.get(ip)
    if known:
        anomaly_score = min(anomaly_score + 0.25, 1.0)
    try:
        octets = ip.split(".")
        first  = int(octets[0])
        is_private = (
            first == 10 or first == 127 or
            (first == 192 and octets[1] == "168") or
            (first == 172 and 16 <= int(octets[1]) <= 31)
        )
        if is_private:
            anomaly_score = max(anomaly_score * 0.3, 0.0)
    except Exception:
        pass

    label, _, _ = _threat_label(anomaly_score)
    mitre = [
        {"technique_id": tid, "technique_name": tname}
        for tid, tname in MITRE_MAP.get(attack_type, [])
    ]

    result = {
        "ip":            ip,
        "anomaly_score": round(anomaly_score, 4),
        "threat_level":  label,
        "attack_type":   attack_type,
        "confidence":    round(confidence, 4),
        "next_moves":    next_moves,
        "mitre":         mitre,
        "intel_match":   {"country": known[0], "note": known[1]} if known else None,
        "features": {
            "dst_port":          features["dst_port"],
            "packet_count":      features["packet_count"],
            "flow_duration_sec": features["flow_duration_sec"],
            "bytes_per_packet":  features["bytes_per_packet"],
            "syn_ratio":         features["syn_ratio"],
            "rst_ratio":         features["rst_ratio"],
            "is_syn_scan":       features["is_syn_scan"],
        },
    }
    _score_cache[ip] = result
    return result


# ═══════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════


@app.get("/api/health")
def health():
    """System health — DB connectivity + model load status."""
    db_ok = False
    db_error = None
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception as e:
        db_error = str(e)

    try:
        from honeycloud.score import _load_models, _CACHE
        models_ok = _load_models()
        model_error = _CACHE.get("error")
    except Exception as e:
        models_ok   = False
        model_error = str(e)

    return {
        "status":    "ok" if db_ok and models_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database":  {"connected": db_ok,    "error": db_error},
        "ml_models": {"loaded":    models_ok, "error": model_error},
    }


@app.get("/api/attacks/live")
def attacks_live(limit: int = Query(50, ge=1, le=500)):
    """Latest N attack events, newest first."""
    # FIX: removed dst_port (not in schema), replaced threat_level → severity
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, src_ip, event_type, username, password,
                   command, timestamp, session_id,
                   anomaly_score, severity, attack_type
            FROM   attacks
            ORDER  BY timestamp DESC
            LIMIT  %s
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        return {"count": len(rows), "attacks": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/attacks/stats")
def attacks_stats():
    """Aggregated attack statistics."""
    # FIX: replaced threat_level → severity throughout
    try:
        conn = _get_conn()
        cur  = conn.cursor()

        # Total counts by event type
        cur.execute("""
            SELECT event_type, COUNT(*) AS count
            FROM   attacks
            GROUP  BY event_type
            ORDER  BY count DESC
        """)
        by_event = [dict(r) for r in cur.fetchall()]

        # Top attack types from ML scoring
        cur.execute("""
            SELECT attack_type, COUNT(*) AS count
            FROM   attacks
            WHERE  attack_type IS NOT NULL
            GROUP  BY attack_type
            ORDER  BY count DESC
        """)
        by_attack_type = [dict(r) for r in cur.fetchall()]

        # Severity distribution  (was: threat_level — column does not exist)
        cur.execute("""
            SELECT severity, COUNT(*) AS count
            FROM   attacks
            WHERE  severity IS NOT NULL
            GROUP  BY severity
            ORDER  BY count DESC
        """)
        by_severity = [dict(r) for r in cur.fetchall()]

        # Attacks per hour (last 24 h)
        cur.execute("""
            SELECT date_trunc('hour', timestamp) AS hour,
                   COUNT(*) AS count
            FROM   attacks
            WHERE  timestamp >= NOW() - INTERVAL '24 hours'
            GROUP  BY hour
            ORDER  BY hour
        """)
        hourly = [dict(r) for r in cur.fetchall()]

        conn.close()
        return {
            "by_event_type":  by_event,
            "by_attack_type": by_attack_type,
            "by_severity":    by_severity,   # renamed from by_threat_level
            "hourly_24h":     hourly,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions")
def sessions(limit: int = Query(20, ge=1, le=200)):
    """Recent honeypot sessions, newest first."""
    # FIX: login_success → login_successes; removed anomaly_score, threat_level,
    #      attack_type (none of these columns exist in the sessions table)
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, session_id, src_ip, start_time, end_time,
                   duration_sec, login_attempts, login_successes, commands_run,
                   hassh, honeypot, created_at
            FROM   sessions
            ORDER  BY start_time DESC
            LIMIT  %s
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        return {"count": len(rows), "sessions": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
def session_detail(session_id: str):
    """Full detail for one session including all its events."""
    # FIX: events query — removed dst_port, replaced threat_level → severity
    try:
        conn = _get_conn()
        cur  = conn.cursor()

        # Session header — SELECT * is safe; schema has no broken columns
        cur.execute("""
            SELECT * FROM sessions WHERE session_id = %s
        """, (session_id,))
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # All events in this session
        cur.execute("""
            SELECT id, event_type, username, password,
                   command, timestamp, anomaly_score, severity, attack_type
            FROM   attacks
            WHERE  session_id = %s
            ORDER  BY timestamp
        """, (session_id,))
        events = [dict(r) for r in cur.fetchall()]
        conn.close()

        return {
            "session": dict(session),
            "events":  events,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/score/{ip}")
def score_ip(ip: str):
    """Run the full IF → XGBoost+RF → Bi-LSTM pipeline on an IP."""
    try:
        return _score_ip(ip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/top-ips")
def top_ips(limit: int = Query(10, ge=1, le=100)):
    """Top attacking source IPs by event count."""
    # NOTE: anomaly_score IS in the attacks table — this query was already correct
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT src_ip,
                   COUNT(*)                                           AS total_events,
                   COUNT(*) FILTER (WHERE event_type='login_failed')  AS failed_logins,
                   COUNT(*) FILTER (WHERE event_type='login_success') AS successful_logins,
                   COUNT(*) FILTER (WHERE event_type='command')       AS commands,
                   MAX(timestamp)                                     AS last_seen,
                   MAX(anomaly_score)                                 AS max_anomaly_score,
                   MODE() WITHIN GROUP (ORDER BY attack_type)         AS top_attack_type
            FROM   attacks
            GROUP  BY src_ip
            ORDER  BY total_events DESC
            LIMIT  %s
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        return {"count": len(rows), "top_ips": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
#  WebSocket — live attack feed
# ═══════════════════════════════════════════════════════════════

@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """
    Push new attack events to the client as they arrive.
    Polls the DB every 2 seconds for rows newer than last seen.
    """
    await hub.connect(websocket)
    last_id = 0

    # FIX: removed dst_port, replaced threat_level → severity in both queries
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, src_ip, event_type, username,
                   timestamp, session_id, anomaly_score, severity, attack_type
            FROM   attacks
            ORDER  BY id DESC
            LIMIT  10
        """)
        rows = list(reversed(cur.fetchall()))
        conn.close()
        if rows:
            last_id = rows[-1]["id"]
            await websocket.send_json({
                "type":    "history",
                "attacks": [_ws_row(r) for r in rows],
            })
    except Exception:
        pass

    try:
        while True:
            await asyncio.sleep(2)
            try:
                conn = _get_conn()
                cur  = conn.cursor()
                cur.execute("""
                    SELECT id, src_ip, event_type, username,
                           timestamp, session_id, anomaly_score,
                           severity, attack_type
                    FROM   attacks
                    WHERE  id > %s
                    ORDER  BY id ASC
                    LIMIT  50
                """, (last_id,))
                rows = cur.fetchall()
                conn.close()
                if rows:
                    last_id = rows[-1]["id"]
                    await websocket.send_json({
                        "type":    "new_attacks",
                        "attacks": [_ws_row(r) for r in rows],
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        hub.disconnect(websocket)


def _ws_row(row: Any) -> dict:
    """Convert a DB row to a JSON-serialisable dict."""
    d = dict(row)
    if isinstance(d.get("timestamp"), datetime):
        d["timestamp"] = d["timestamp"].isoformat()
    return d


# ═══════════════════════════════════════════════════════════════
#  Dev entry-point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)