import os
import json
import click
import numpy as np

# ─────────────────────────────────────────────
#  Model paths
# ─────────────────────────────────────────────
_HERE        = os.path.dirname(__file__)
_MODELS_DIR  = os.path.join(_HERE, "..", "layer2", "models")

MODEL_PATHS = {
    "isolation_forest"  : os.path.join(_MODELS_DIR, "isolation_forest.pkl"),
    "xgboost"           : os.path.join(_MODELS_DIR, "xgboost_classifier.pkl"),
    "random_forest"     : os.path.join(_MODELS_DIR, "random_forest.pkl"),
    "label_encoder"     : os.path.join(_MODELS_DIR, "label_encoder.pkl"),
    "feature_cols"      : os.path.join(_MODELS_DIR, "feature_cols.json"),
    "hornet40_baseline" : os.path.join(_MODELS_DIR, "hornet40_baseline.json"),
}

# ─────────────────────────────────────────────
#  Lazy model loader — loads once, reuses
# ─────────────────────────────────────────────
_CACHE = {}

def _load_models() -> bool:
    """Load all models into cache. Returns True if successful."""
    if _CACHE:
        return True
    try:
        import joblib
        _CACHE["iso"]      = joblib.load(MODEL_PATHS["isolation_forest"])
        _CACHE["xgb"]      = joblib.load(MODEL_PATHS["xgboost"])
        _CACHE["rf"]       = joblib.load(MODEL_PATHS["random_forest"])
        _CACHE["le"]       = joblib.load(MODEL_PATHS["label_encoder"])
        with open(MODEL_PATHS["feature_cols"])      as f:
            _CACHE["feature_cols"] = json.load(f)
        with open(MODEL_PATHS["hornet40_baseline"]) as f:
            _CACHE["baseline"] = json.load(f)
        return True
    except Exception as e:
        _CACHE["error"] = str(e)
        return False

# ─────────────────────────────────────────────
#  Known threat intelligence
# ─────────────────────────────────────────────
KNOWN_MALICIOUS = {
    "45.33.32.156":    ("RU",  "Known SSH bruteforcer — Shodan crawler ASN"),
    "198.20.69.74":    ("CN",  "Censys scanning infrastructure"),
    "185.220.101.45":  ("TOR", "Tor exit node — high-risk anonymised traffic"),
    "89.248.165.200":  ("NL",  "Shadowserver scanning probe"),
    "66.240.236.116":  ("US",  "Shodan.io scanner — multi-protocol prober"),
    "5.190.78.249":    ("IR",  "Persistent SMB brute forcer"),
    "62.197.136.132":  ("DE",  "Recurring HTTP scanner"),
}

# MITRE ATT&CK mappings per attack label
MITRE_MAP = {
    "smb_exploit": [
        ("T1021.002", "Remote Services: SMB/Windows Admin Shares"),
        ("T1110.001", "Brute Force: Password Guessing"),
    ],
    "db_probe": [
        ("T1505.001", "Server Software Component: SQL"),
        ("T1190",     "Exploit Public-Facing Application"),
    ],
    "web_scan": [
        ("T1190",     "Exploit Public-Facing Application"),
        ("T1595.002", "Active Scanning: Vulnerability Scanning"),
    ],
    "ftp_probe": [
        ("T1071.002", "Application Layer Protocol: File Transfer"),
        ("T1110.001", "Brute Force: Password Guessing"),
    ],
    "vpn_probe": [
        ("T1133",     "External Remote Services"),
        ("T1110.001", "Brute Force: Password Guessing"),
    ],
    "iot_probe": [
        ("T1059",     "Command and Scripting Interpreter"),
        ("T1190",     "Exploit Public-Facing Application"),
    ],
    "rpc_probe": [
        ("T1021.003", "Remote Services: Distributed Component Object Model"),
        ("T1190",     "Exploit Public-Facing Application"),
    ],
}

# ─────────────────────────────────────────────
#  Feature engineering
#  Builds the same 19-feature vector the model
#  was trained on — order must match exactly
# ─────────────────────────────────────────────
def _build_feature_vector(ip: str, session_data: dict = None) -> dict:
    """
    Build a feature vector for an IP address.

    In production this would pull live session data from
    the Cowrie log / Kafka pipeline. For CLI scoring we
    derive deterministic features from the IP's structure
    and any session data passed in.
    """
    import hashlib

    # deterministic seed from IP — simulates per-IP history
    seed = int(hashlib.md5(ip.encode()).hexdigest(), 16) % (10 ** 8)
    r    = lambda lo, hi: lo + (seed % (hi - lo + 1))

    # if real session data passed in, use it — else simulate
    if session_data:
        dst_port        = session_data.get("dst_port", r(21, 27017))
        src_port        = session_data.get("src_port", r(1024, 65534))
        hour            = session_data.get("hour", r(0, 23))
        day_of_week     = session_data.get("day_of_week", r(0, 6))
        inter_arrival   = session_data.get("inter_arrival_sec", r(0, 3600))
        conn_count      = session_data.get("conn_count", r(1, 500))
        port_entropy    = session_data.get("port_entropy", r(0, 100) / 100.0)
        proto_diversity = session_data.get("proto_diversity", r(1, 5))
        protocol        = session_data.get("protocol", "smbd")
    else:
        # simulate realistic values from IP seed
        dst_port        = [445, 81, 1433, 3306, 21, 22, 27017, 135][seed % 8]
        src_port        = r(1024, 65534)
        hour            = r(0, 23)
        day_of_week     = r(0, 6)
        inter_arrival   = r(0, 3600)
        conn_count      = r(1, 800)
        port_entropy    = round(r(0, 100) / 100.0, 4)
        proto_diversity = r(1, 5)
        protocol        = ["smbd", "httpd", "mssqld", "mysqld",
                           "ftpd", "pptpd", "epmapper"][seed % 7]

    # port bucket: 0=well-known, 1=registered, 2=dynamic
    def _bucket(p):
        if p < 1024:   return 0
        if p < 49152:  return 1
        return 2

    # protocol one-hot — must match training columns exactly
    all_protocols = ["epmapper","ftpd","httpd","mongod",
                     "mqttd","mssqld","mysqld","pptpd","smbd"]
    proto_onehot  = {f"proto_{p}": int(protocol == p)
                     for p in all_protocols}

    features = {
        "dst_port"          : float(dst_port),
        "src_port"          : float(src_port),
        "hour"              : float(hour),
        "day_of_week"       : float(day_of_week),
        "dst_port_bucket"   : float(_bucket(dst_port)),
        "src_port_bucket"   : float(_bucket(src_port)),
        "inter_arrival_sec" : float(inter_arrival),
        "conn_count"        : float(conn_count),
        "port_entropy"      : float(port_entropy),
        "proto_diversity"   : float(proto_diversity),
        **{k: float(v) for k, v in proto_onehot.items()},
    }
    return features


def _features_to_array(features: dict) -> np.ndarray:
    """Convert feature dict to numpy array in exact training column order."""
    feature_cols = _CACHE["feature_cols"]
    return np.array([[features.get(col, 0.0) for col in feature_cols]])


# ─────────────────────────────────────────────
#  Threat label helper
# ─────────────────────────────────────────────
def _threat_label(score: float) -> tuple:
    if score >= 0.80: return ("CRITICAL", "red",    "🔴")
    if score >= 0.60: return ("HIGH",     "yellow", "🟠")
    if score >= 0.40: return ("MEDIUM",   "cyan",   "🟡")
    return                    ("LOW",      "green",  "🟢")


# ─────────────────────────────────────────────
#  Main run function
# ─────────────────────────────────────────────

import warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", message=".*InconsistentVersionWarning.*")

def run(ip: str, session_data: dict = None):
    click.echo(click.style(
        "\n  🍯 HoneyCloud — Threat Scoring Engine",
        fg="yellow", bold=True))
    click.echo(click.style(
        "  ─────────────────────────────────────────\n", fg="white"))
    click.echo(f"  Analysing: {click.style(ip, fg='cyan')}\n")

    # ── Step 1 — Load models ──────────────────
    click.echo(click.style(
        "  [1/4] Loading ML models...", fg="bright_black"))
    models_available = _load_models()

    if not models_available:
        click.echo(click.style(
            f"  [WARN] Models not found: {_CACHE.get('error', 'unknown error')}\n"
            f"  [WARN] Run the training notebook first.\n"
            f"  [WARN] Falling back to heuristic scoring.\n",
            fg="yellow"
        ))
        _run_heuristic(ip)
        return

    click.echo(click.style(
        "  [2/4] Building feature vector...", fg="bright_black"))
    features = _build_feature_vector(ip, session_data)
    X        = _features_to_array(features)

    # ── Step 3 — Isolation Forest anomaly score ──
    click.echo(click.style(
        "  [3/4] Running Isolation Forest...", fg="bright_black"))
    raw_score      = _CACHE["iso"].decision_function(X)[0]
    is_anomaly_raw = _CACHE["iso"].predict(X)[0]  # -1=anomaly, 1=normal

    # normalize to 0-1 (more negative = more anomalous = higher score)
    # typical range is -0.5 to 0.5 for Isolation Forest
    anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

    # ── Step 4 — XGBoost attack classification ───
    click.echo(click.style(
        "  [4/4] Classifying attack type...\n", fg="bright_black"))
    xgb_probs = _CACHE["xgb"].predict_proba(X)[0]
    rf_probs  = _CACHE["rf"].predict_proba(X)[0]
    ensemble  = (xgb_probs + rf_probs) / 2
    pred_idx  = int(np.argmax(ensemble))
    confidence= float(ensemble[pred_idx])
    attack_type = _CACHE["le"].inverse_transform([pred_idx])[0]

    # ── Threat intel boost ────────────────────
    known = KNOWN_MALICIOUS.get(ip)
    if known:
        anomaly_score = min(anomaly_score + 0.25, 1.0)

    # private IP penalty
    octets = ip.split(".")
    try:
        first = int(octets[0])
        is_private = (
            first == 10 or first == 127 or
            (first == 192 and octets[1] == "168") or
            (first == 172 and 16 <= int(octets[1]) <= 31)
        )
        if is_private:
            anomaly_score = max(anomaly_score * 0.3, 0.0)
    except Exception:
        is_private = False

    label, color, icon = _threat_label(anomaly_score)

    # ── Hornet40 baseline context ─────────────
    baseline      = _CACHE["baseline"]
    baseline_mean = baseline["mean"]
    baseline_std  = baseline["std"]
    threshold     = baseline["threshold"]

    # ── Output ────────────────────────────────
    bar_filled = int(anomaly_score * 30)
    bar = (click.style("█" * bar_filled, fg=color) +
           click.style("░" * (30 - bar_filled), fg="bright_black"))

    click.echo(f"  {'─'*54}")
    click.echo(f"  IP Address    : {click.style(ip, fg='cyan')}")
    click.echo(f"  Anomaly Score : {bar}  "
               f"{click.style(f'{anomaly_score:.2%}', bold=True)}")
    click.echo(f"  Threat Level  : {icon}  "
               f"{click.style(label, fg=color, bold=True)}")
    click.echo(f"  Attack Type   : "
               f"{click.style(attack_type, fg='magenta')}  "
               f"({confidence:.0%} confidence)")

    if known:
        click.echo(f"  Intel Match   : "
                   f"{click.style(known[1], fg='red')}  [{known[0]}]")

    # MITRE ATT&CK
    mitre_techs = MITRE_MAP.get(attack_type, [])
    if mitre_techs:
        click.echo(f"\n  {click.style('MITRE ATT&CK:', fg='bright_black')}")
        for tid, tname in mitre_techs:
            click.echo(f"    {click.style(tid, fg='magenta')}  {tname}")

    # Feature breakdown
    click.echo(f"\n  {click.style('Feature Breakdown:', fg='bright_black')}")
    display = {
        "dst_port"          : ("Target port",         features["dst_port"]),
        "conn_count"        : ("Connection count",    features["conn_count"]),
        "inter_arrival_sec" : ("Inter-arrival (sec)", features["inter_arrival_sec"]),
        "port_entropy"      : ("Port entropy",        features["port_entropy"]),
        "proto_diversity"   : ("Protocol diversity",  features["proto_diversity"]),
        "hour"              : ("Hour of day",         features["hour"]),
    }
    for _, (label_str, val) in display.items():
        click.echo(f"    {label_str:<26}: "
                   f"{click.style(str(round(val, 3)), fg='yellow')}")

    # Hornet40 baseline context
    click.echo(f"\n  {click.style('Hornet40 Geo Baseline:', fg='bright_black')}")
    click.echo(f"    Normal range  : 0 — "
               f"{click.style(str(round(threshold)), fg='green')} flows/hr")
    click.echo(f"    Global mean   : "
               f"{click.style(str(round(baseline_mean, 1)), fg='white')} flows/hr")

    click.echo(f"\n  {'─'*54}\n")


# ─────────────────────────────────────────────
#  Heuristic fallback (if models not found)
# ─────────────────────────────────────────────
def _run_heuristic(ip: str):
    """Original hand-coded scoring — used as fallback only."""
    import hashlib
    seed  = int(hashlib.md5(ip.encode()).hexdigest(), 16) % (10 ** 8)
    score = round((seed % 100) / 100.0, 4)
    known = KNOWN_MALICIOUS.get(ip)
    if known:
        score = min(score + 0.3, 1.0)
    label, color, icon = _threat_label(score)
    bar_filled = int(score * 30)
    bar = (click.style("█" * bar_filled, fg=color) +
           click.style("░" * (30 - bar_filled), fg="bright_black"))
    click.echo(f"  {'─'*50}")
    click.echo(f"  IP Address   : {click.style(ip, fg='cyan')}")
    click.echo(f"  Anomaly Score: {bar}  "
               f"{click.style(f'{score:.2%}', bold=True)}")
    click.echo(f"  Threat Level : {icon}  "
               f"{click.style(label, fg=color, bold=True)}")
    if known:
        click.echo(f"  Intel Match  : "
                   f"{click.style(known[1], fg='red')}  [{known[0]}]")
    click.echo(f"\n  {'─'*50}\n")