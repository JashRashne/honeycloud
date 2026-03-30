"""
HoneyCloud — FastAPI Backend
api/main.py
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
import sys
import zipfile
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


DB_URL = os.environ.get(
    "HONEYCLOUD_DB_URL",
    "postgresql://honeycloud:honeycloud@localhost:5432/honeycloud",
)

app = FastAPI(
    title="HoneyCloud API",
    description="Threat intelligence API for the HoneyCloud honeypot platform",
    version="0.1.0",
)

# Add your Vercel URL here
origins = [
    "https://honeycloud.vercel.app",
    "http://localhost:5173", # For local testing
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "ngrok-skip-browser-warning"], # Explicitly allow the bypass header
)



# HELPER: This ensures that even if Ngrok sends a weird header, 
# FastAPI handles the WebSocket handshake correctly.
@app.middleware("http")
async def add_ngrok_skip_header(request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    return response


# ═══════════════════════════════════════════════════════════════
#  DB pool — created once, reused across all requests
# ═══════════════════════════════════════════════════════════════

async def _create_pool() -> asyncpg.Pool:
    # asyncpg needs postgresql:// not postgresql+psycopg2://
    dsn = DB_URL.replace("postgresql+psycopg2://", "postgresql://")
    return await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=5,
        max_inactive_connection_lifetime=240,  # keepalive — NeonDB suspends at 5min
        command_timeout=10,
    )


@app.on_event("startup")
async def startup():
    app.state.pool = await _create_pool()
    # Pre-warm: one query so first real request is instant
    async with app.state.pool.acquire() as conn:
        await conn.fetchval("SELECT 1")


@app.on_event("shutdown")
async def shutdown():
    await app.state.pool.close()


def _pool() -> asyncpg.Pool:
    return app.state.pool


# ── WebSocket hub ─────────────────────────────────────────────
class _Hub:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._clients:
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

# ── Score cache ───────────────────────────────────────────────
_score_cache: dict[str, dict] = {}

# ── GeoIP cache ───────────────────────────────────────────────
_geoip_cache: dict[str, dict] = {}

def _score_ip(ip: str, cmd: str = "") -> dict:
    import warnings
    import numpy as np
    warnings.filterwarnings("ignore")

    from honeycloud.score import (
        _load_models, _build_feature_vector, _features_to_array,
        _threat_label, KNOWN_MALICIOUS, MITRE_MAP, _CACHE,
    )

    _load_models()

    # ── SMART DEMO MAPPING ──
    port = 22
    proto = 6

    if "ping" in cmd:
        proto = 1
    elif any(x in cmd for x in ["wget", "curl", "http"]):
        port = 80
    elif any(x in cmd for x in ["mysql", "sql", "postgres"]):
        port = 3306
    elif "smb" in cmd:
        port = 445
    elif "ftp" in cmd:
        port = 21
    elif "telnet" in cmd:
        port = 23
    elif "vnc" in cmd:
        port = 5900

    session_data = {
        "dst_port": port,
        "protocol": proto
    }

    features = _build_feature_vector(ip, session_data=session_data)

    # Explicitly force the Layer 4 ML features ──
    features["dst_port"] = float(port)
    features["is_tcp"]   = 1.0 if proto == 6 else 0.0
    features["is_udp"]   = 1.0 if proto == 17 else 0.0
    features["is_icmp"]  = 1.0 if proto == 1 else 0.0

    X = _features_to_array(features)

    raw_score = _CACHE["iso"].decision_function(X)[0]
    anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

    xgb_probs   = _CACHE["xgb"].predict_proba(X)[0]
    rf_probs    = _CACHE["rf"].predict_proba(X)[0]
    ensemble    = (xgb_probs + rf_probs) / 2
    pred_idx    = int(np.argmax(ensemble))
    confidence  = float(ensemble[pred_idx])
    attack_type = _CACHE["le"].inverse_transform([pred_idx])[0]

    next_moves: list[dict] = []
    if _CACHE.get("lstm") is not None:
        try:
            SEQ_LEN   = 5
            feat_cols = _CACHE["feature_cols"]
            single    = np.array(
                [features.get(c, 0.0) for c in feat_cols], dtype=np.float32
            )
            X_seq = _CACHE["lstm_scaler"].transform(
                np.tile(single, (SEQ_LEN, 1))
            ).reshape(1, SEQ_LEN, len(feat_cols)).astype(np.float32)
            sess     = _CACHE["lstm"]
            inp_name = sess.get_inputs()[0].name
            probs    = sess.run(None, {inp_name: X_seq})[0][0]
            top2_idx = np.argsort(probs)[::-1][:2]
            classes  = _CACHE["lstm_le"].classes_
            next_moves = [
                {"attack_type": classes[i], "probability": float(probs[i])}
                for i in top2_idx
            ]
        except Exception:
            pass

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
    return result

# ═══════════════════════════════════════════════════════════════
#  GeoIP helpers
# ═══════════════════════════════════════════════════════════════

def _is_private(ip: str) -> bool:
    try:
        octets = ip.split(".")
        first = int(octets[0])
        return (
            first == 10 or first == 127 or
            (first == 192 and octets[1] == "168") or
            (first == 172 and 16 <= int(octets[1]) <= 31)
        )
    except Exception:
        return False


async def _fetch_geoip(ip: str) -> dict:
    if ip in _geoip_cache:
        return _geoip_cache[ip]

    if _is_private(ip):
        result = {"ip": ip, "private": True, "lat": None, "lon": None,
                  "country": "Private", "countryCode": None, "city": None,
                  "isp": None, "org": None}
        _geoip_cache[ip] = result
        return result

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,countryCode,city,lat,lon,isp,org"}
            )
            data = r.json()
            if data.get("status") == "success":
                result = {
                    "ip":          ip,
                    "private":     False,
                    "country":     data.get("country"),
                    "countryCode": data.get("countryCode"),
                    "city":        data.get("city"),
                    "lat":         data.get("lat"),
                    "lon":         data.get("lon"),
                    "isp":         data.get("isp"),
                    "org":         data.get("org"),
                }
                _geoip_cache[ip] = result
                return result
    except Exception:
        pass

    return {"ip": ip, "private": False, "lat": None, "lon": None,
            "country": None, "countryCode": None, "city": None,
            "isp": None, "org": None}


# ── asyncpg returns Record objects — convert to plain dicts ───
def _rec(row: Any) -> dict:
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def _recs(rows: list) -> list[dict]:
    return [_rec(r) for r in rows]


# ═══════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    db_ok    = False
    db_error = None
    try:
        async with _pool().acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception as e:
        db_error = str(e)

    try:
        from honeycloud.score import _load_models, _CACHE
        models_ok   = _load_models()
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
async def attacks_live(limit: int = Query(50, ge=1, le=500)):
    try:
        async with _pool().acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, src_ip, event_type, username, password,
                       command, timestamp, session_id,
                       anomaly_score, severity, attack_type
                FROM   attacks
                ORDER  BY timestamp DESC
                LIMIT  $1
            """, limit)
        return {"count": len(rows), "attacks": _recs(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/attacks/stats")
async def attacks_stats():
    try:
        async with _pool().acquire() as conn:
            by_event = await conn.fetch("""
                SELECT event_type, COUNT(*) AS count
                FROM   attacks
                GROUP  BY event_type
                ORDER  BY count DESC
            """)
            by_attack_type = await conn.fetch("""
                SELECT attack_type, COUNT(*) AS count
                FROM   attacks
                WHERE  attack_type IS NOT NULL
                GROUP  BY attack_type
                ORDER  BY count DESC
            """)
            by_severity = await conn.fetch("""
                SELECT severity, COUNT(*) AS count
                FROM   attacks
                WHERE  severity IS NOT NULL
                GROUP  BY severity
                ORDER  BY count DESC
            """)
            hourly = await conn.fetch("""
                SELECT date_trunc('hour', timestamp) AS hour,
                       COUNT(*) AS count
                FROM   attacks
                WHERE  timestamp >= NOW() - INTERVAL '24 hours'
                GROUP  BY hour
                ORDER  BY hour
            """)
        return {
            "by_event_type":  _recs(by_event),
            "by_attack_type": _recs(by_attack_type),
            "by_severity":    _recs(by_severity),
            "hourly_24h":     _recs(hourly),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions")
async def sessions(limit: int = Query(20, ge=1, le=200)):
    try:
        async with _pool().acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, session_id, src_ip, start_time, end_time,
                       duration_sec, login_attempts, login_successes, commands_run,
                       hassh, honeypot, created_at
                FROM   sessions
                ORDER  BY start_time DESC
                LIMIT  $1
            """, limit)
        return {"count": len(rows), "sessions": _recs(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def session_detail(session_id: str):
    try:
        async with _pool().acquire() as conn:
            session = await conn.fetchrow(
                "SELECT * FROM sessions WHERE session_id = $1", session_id
            )
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            events = await conn.fetch("""
                SELECT id, event_type, username, password,
                       command, timestamp, anomaly_score, severity, attack_type
                FROM   attacks
                WHERE  session_id = $1
                ORDER  BY timestamp
            """, session_id)
        return {"session": _rec(session), "events": _recs(events)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/ip/{ip}")
async def sessions_by_ip(ip: str, limit: int = Query(50, ge=1, le=500)):
    """
    Return sessions for one source IP with a step-by-step attack timeline per session.
    """
    try:
        async with _pool().acquire() as conn:
            sessions_rows = await conn.fetch(
                """
                SELECT id, session_id, src_ip, start_time, end_time,
                       duration_sec, login_attempts, login_successes, commands_run,
                       hassh, honeypot, created_at
                FROM   sessions
                WHERE  src_ip = $1
                ORDER  BY start_time DESC
                LIMIT  $2
                """,
                ip,
                limit,
            )

            if not sessions_rows:
                return {"ip": ip, "count": 0, "sessions": []}

            session_ids = [r["session_id"] for r in sessions_rows]
            attack_rows = await conn.fetch(
                """
                SELECT id, session_id, src_ip, event_type, username, password,
                       command, timestamp, anomaly_score, severity, attack_type
                FROM   attacks
                WHERE  session_id = ANY($1::text[])
                ORDER  BY session_id, timestamp, id
                """,
                session_ids,
            )

        steps_by_session: dict[str, list[dict]] = {sid: [] for sid in session_ids}
        for row in attack_rows:
            sid = row["session_id"]
            if sid in steps_by_session:
                steps_by_session[sid].append(_rec(row))

        result_sessions = []
        for session_row in sessions_rows:
            session_dict = _rec(session_row)
            sid = session_row["session_id"]
            session_dict["steps"] = steps_by_session.get(sid, [])
            session_dict["step_count"] = len(session_dict["steps"])
            result_sessions.append(session_dict)

        return {
            "ip": ip,
            "count": len(result_sessions),
            "sessions": result_sessions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/score/{ip}")
async def score_ip(ip: str):
    try:
        cmd = ""
        # Look up the most recent command this IP ran in the database
        try:
            async with _pool().acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT command FROM attacks
                    WHERE src_ip = $1 AND command IS NOT NULL AND command != ''
                    ORDER BY timestamp DESC LIMIT 1
                """, ip)
                if row and row["command"]:
                    cmd = row["command"].lower()
        except Exception:
            pass

        # Pass the command into our scoring logic
        return _score_ip(ip, cmd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/top-ips")
async def top_ips(limit: int = Query(10, ge=1, le=100)):
    try:
        async with _pool().acquire() as conn:
            rows = await conn.fetch("""
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
                LIMIT  $1
            """, limit)
        return {"count": len(rows), "top_ips": _recs(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/csv")
async def export_db_csv():
    """
    Export all public tables as a ZIP file with one CSV per table.
    Each CSV contains the table's real columns as headers.
    """
    try:
        async with _pool().acquire() as conn:
            tables = await conn.fetch(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )

            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(
                zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED
            ) as zf:
                for table in tables:
                    table_name = table["table_name"]

                    col_rows = await conn.fetch(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = $1
                        ORDER BY ordinal_position
                        """,
                        table_name,
                    )
                    fieldnames = [c["column_name"] for c in col_rows]
                    if not fieldnames:
                        continue

                    rows = await conn.fetch(f'SELECT * FROM "{table_name}"')

                    csv_buffer = io.StringIO()
                    writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
                    writer.writeheader()
                    for row in rows:
                        writer.writerow(_rec(row))

                    zf.writestr(f"{table_name}.csv", csv_buffer.getvalue())

        zip_buffer.seek(0)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        headers = {
            "Content-Disposition": f'attachment; filename="honeycloud_db_export_{ts}.zip"'
        }
        return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GeoIP endpoints ───────────────────────────────────────────

@app.get("/api/geoip/{ip}")
async def geoip_single(ip: str):
    return await _fetch_geoip(ip)


@app.get("/api/geoip")
async def geoip_batch(ips: str):
    ip_list  = [i.strip() for i in ips.split(",") if i.strip()][:20]
    cached   = [ip for ip in ip_list if ip in _geoip_cache]
    uncached = [ip for ip in ip_list if ip not in _geoip_cache]

    results = {ip: _geoip_cache[ip] for ip in cached}
    for ip in uncached:
        results[ip] = await _fetch_geoip(ip)
        if len(uncached) > 5:
            await asyncio.sleep(0.2)

    return {"results": results}


# ═══════════════════════════════════════════════════════════════
#  WebSocket
# ═══════════════════════════════════════════════════════════════

@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await hub.connect(websocket)
    last_id = 0

    # Send history immediately after accept — pool is already warm
    try:
        async with _pool().acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, src_ip, event_type, username,
                       timestamp, session_id, anomaly_score, severity, attack_type
                FROM   attacks
                ORDER  BY id DESC
                LIMIT  10
            """)
        rows = list(reversed(rows))
        if rows:
            last_id = rows[-1]["id"]
            await websocket.send_json({
                "type":    "history",
                "attacks": _recs(rows),
            })
    except Exception:
        pass

    try:
        while True:
            await asyncio.sleep(2)
            try:
                async with _pool().acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT id, src_ip, event_type, username,
                               timestamp, session_id, anomaly_score,
                               severity, attack_type
                        FROM   attacks
                        WHERE  id > $1
                        ORDER  BY id ASC
                        LIMIT  50
                    """, last_id)
                if rows:
                    last_id = rows[-1]["id"]
                    await websocket.send_json({
                        "type":    "new_attacks",
                        "attacks": _recs(rows),
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        hub.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)