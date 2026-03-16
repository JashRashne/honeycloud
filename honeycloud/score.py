import os
import json
import warnings
import click
import numpy as np

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  Model paths
# ─────────────────────────────────────────────
_HERE       = os.path.dirname(__file__)
_MODELS_DIR = os.path.join(_HERE, "models")

MODEL_PATHS = {
    "isolation_forest"  : os.path.join(_MODELS_DIR, "isolation_forest.pkl"),
    "xgboost"           : os.path.join(_MODELS_DIR, "xgboost_classifier.pkl"),
    "random_forest"     : os.path.join(_MODELS_DIR, "random_forest.pkl"),
    "label_encoder"     : os.path.join(_MODELS_DIR, "label_encoder.pkl"),
    "feature_cols"      : os.path.join(_MODELS_DIR, "flow_feature_cols.json"),
    "hornet40_baseline" : os.path.join(_MODELS_DIR, "hornet40_baseline.json"),
    "bilstm"            : os.path.join(_MODELS_DIR, "bilstm_model.keras"),
    "lstm_scaler"       : os.path.join(_MODELS_DIR, "lstm_scaler.pkl"),
    "lstm_le"           : os.path.join(_MODELS_DIR, "lstm_label_encoder.pkl"),
    "bilstm_onnx" : os.path.join(_MODELS_DIR, "bilstm_model.onnx"),
}

_CACHE = {}

def _load_models() -> bool:
    if _CACHE:
        return True
    try:
        import joblib
        _CACHE["iso"] = joblib.load(MODEL_PATHS["isolation_forest"])
        _CACHE["xgb"] = joblib.load(MODEL_PATHS["xgboost"])
        _CACHE["rf"]  = joblib.load(MODEL_PATHS["random_forest"])
        _CACHE["le"]  = joblib.load(MODEL_PATHS["label_encoder"])
        with open(MODEL_PATHS["feature_cols"]) as f:
            _CACHE["feature_cols"] = json.load(f)
        with open(MODEL_PATHS["hornet40_baseline"]) as f:
            _CACHE["baseline"] = json.load(f)
        # NEW ↓ — LSTM is optional, won't crash score if files missing
        try:
            import onnxruntime as ort
            sess = ort.InferenceSession(
                MODEL_PATHS["bilstm_onnx"],
                providers=["CPUExecutionProvider"]
            )
            _CACHE["lstm"]        = sess
            _CACHE["lstm_scaler"] = joblib.load(MODEL_PATHS["lstm_scaler"])
            _CACHE["lstm_le"]     = joblib.load(MODEL_PATHS["lstm_le"])
        except Exception:
            _CACHE["lstm"] = None
        return True          # ← this line must be here


    except Exception as e:
        _CACHE["error"] = str(e)
        return False
    

KNOWN_MALICIOUS = {
    "45.33.32.156":    ("RU",  "Known SSH bruteforcer — Shodan crawler ASN"),
    "198.20.69.74":    ("CN",  "Censys scanning infrastructure"),
    "185.220.101.45":  ("TOR", "Tor exit node — high-risk anonymised traffic"),
    "89.248.165.200":  ("NL",  "Shadowserver scanning probe"),
    "66.240.236.116":  ("US",  "Shodan.io scanner — multi-protocol prober"),
    "5.190.78.249":    ("IR",  "Persistent SMB brute forcer"),
    "62.197.136.132":  ("DE",  "Recurring HTTP scanner"),
}

MITRE_MAP = {
    "ssh_bruteforce":  [("T1110.001", "Brute Force: Password Guessing"),
                        ("T1021.004", "Remote Services: SSH")],
    "vnc_bruteforce":  [("T1110.001", "Brute Force: Password Guessing"),
                        ("T1021.005", "Remote Services: VNC")],
    "smb_exploit":     [("T1021.002", "Remote Services: SMB"),
                        ("T1110.001", "Brute Force: Password Guessing")],
    "db_probe":        [("T1505.001", "Server Software Component: SQL"),
                        ("T1190",     "Exploit Public-Facing Application")],
    "web_scan":        [("T1190",     "Exploit Public-Facing Application"),
                        ("T1595.002", "Active Scanning: Vulnerability Scanning")],
    "port_scan":       [("T1046",     "Network Service Discovery"),
                        ("T1595.001", "Active Scanning: Scanning IP Blocks")],
    "telnet_probe":    [("T1021.004", "Remote Services: SSH/Telnet"),
                        ("T1110.001", "Brute Force: Password Guessing")],
    "ftp_probe":       [("T1071.002", "Application Layer Protocol: FTP"),
                        ("T1110.001", "Brute Force: Password Guessing")],
    "snmp_probe":      [("T1602.001", "Data from Configuration Repository: SNMP"),
                        ("T1046",     "Network Service Discovery")],
    "iot_probe":       [("T1059",     "Command and Scripting Interpreter"),
                        ("T1190",     "Exploit Public-Facing Application")],
    "icmp_scan":       [("T1595.001", "Active Scanning: Scanning IP Blocks"),
                        ("T1046",     "Network Service Discovery")],
}

def _build_feature_vector(ip: str, session_data: dict = None) -> dict:
    import hashlib
    seed = int(hashlib.md5(ip.encode()).hexdigest(), 16) % (10 ** 8)
    r    = lambda lo, hi: lo + (seed % (hi - lo + 1))

    if session_data:
        dst_port      = session_data.get("dst_port",          r(21, 27017))
        src_port      = session_data.get("src_port",          r(1024, 65534))
        hour          = session_data.get("hour",              r(0, 23))
        day_of_week   = session_data.get("day_of_week",       r(0, 6))
        packet_count  = session_data.get("packet_count",      r(1, 1000))
        total_bytes   = session_data.get("total_bytes",       r(100, 100000))
        flow_duration = session_data.get("flow_duration_sec", r(0, 300))
        syn_ratio     = session_data.get("syn_ratio",         r(0, 100)/100.0)
        rst_ratio     = session_data.get("rst_ratio",         r(0, 100)/100.0)
        is_syn_scan   = session_data.get("is_syn_scan",       0)
        protocol      = session_data.get("protocol",          6)
    else:
        dst_port      = [22, 5900, 80, 445, 23, 1433, 3306, 21][seed % 8]
        src_port      = r(1024, 65534)
        hour          = r(0, 23)
        day_of_week   = r(0, 6)
        packet_count  = r(2, 800)
        total_bytes   = packet_count * r(60, 1500)
        flow_duration = r(0, 120)
        syn_ratio     = round(r(0, 100) / 100.0, 3)
        rst_ratio     = round(r(0, 100) / 100.0, 3)
        is_syn_scan   = int(syn_ratio > 0.7 and packet_count <= 2)
        protocol      = 6

    def _bucket(p):
        if p < 1024:  return 0
        if p < 49152: return 1
        return 2

    mean_pkt  = total_bytes / max(packet_count, 1)
    fin_ratio = round(r(0, 30) / 100.0, 3)

    return {
        "dst_port"         : float(dst_port),
        "src_port"         : float(src_port),
        "hour"             : float(hour),
        "day_of_week"      : float(day_of_week),
        "dst_port_bucket"  : float(_bucket(dst_port)),
        "src_port_bucket"  : float(_bucket(src_port)),
        "packet_count"     : float(packet_count),
        "total_bytes"      : float(total_bytes),
        "mean_pkt_size"    : float(mean_pkt),
        "std_pkt_size"     : float(mean_pkt * 0.3),
        "total_payload"    : float(total_bytes * 0.6),
        "mean_ttl"         : float(r(32, 128)),
        "flag_syn_count"   : float(int(syn_ratio * packet_count)),
        "flag_ack_count"   : float(int((1 - syn_ratio) * packet_count)),
        "flag_rst_count"   : float(int(rst_ratio * packet_count)),
        "flag_fin_count"   : float(int(fin_ratio * packet_count)),
        "flag_psh_count"   : float(int(0.3 * packet_count)),
        "is_tcp"           : float(int(protocol == 6)),
        "is_udp"           : float(int(protocol == 17)),
        "is_icmp"          : float(int(protocol == 1)),
        "flow_duration_sec": float(flow_duration),
        "bytes_per_packet" : float(mean_pkt),
        "syn_ratio"        : float(syn_ratio),
        "rst_ratio"        : float(rst_ratio),
        "fin_ratio"        : float(fin_ratio),
        "is_syn_scan"      : float(is_syn_scan),
    }


def _features_to_array(features: dict) -> np.ndarray:
    return np.array([[features.get(col, 0.0)
                      for col in _CACHE["feature_cols"]]])


def _threat_label(score: float) -> tuple:
    if score >= 0.80: return ("CRITICAL", "red",    "🔴")
    if score >= 0.60: return ("HIGH",     "yellow", "🟠")
    if score >= 0.40: return ("MEDIUM",   "cyan",   "🟡")
    return                    ("LOW",      "green",  "🟢")

def run(ip: str, session_data: dict = None):
    click.echo(click.style(
        "\n  🍯 HoneyCloud — Threat Scoring Engine",
        fg="yellow", bold=True))
    click.echo(click.style(
        "  ─────────────────────────────────────────\n", fg="white"))
    click.echo(f"  Analysing: {click.style(ip, fg='cyan')}\n")

    click.echo(click.style("  [1/4] Loading ML models...", fg="bright_black"))
    if not _load_models():
        click.echo(click.style(
            f"  [WARN] Models not found: {_CACHE.get('error')}\n"
            f"  [WARN] Falling back to heuristic scoring.\n",
            fg="yellow"))
        _run_heuristic(ip)
        return

    click.echo(click.style("  [2/4] Building flow feature vector...", fg="bright_black"))
    features = _build_feature_vector(ip, session_data)
    X        = _features_to_array(features)

    click.echo(click.style("  [3/4] Running Isolation Forest...", fg="bright_black"))
    raw_score     = _CACHE["iso"].decision_function(X)[0]
    anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

    click.echo(click.style("  [4/4] Classifying attack type...", fg="bright_black"))
    xgb_probs   = _CACHE["xgb"].predict_proba(X)[0]
    rf_probs    = _CACHE["rf"].predict_proba(X)[0]
    ensemble    = (xgb_probs + rf_probs) / 2
    pred_idx    = int(np.argmax(ensemble))
    confidence  = float(ensemble[pred_idx])
    attack_type = _CACHE["le"].inverse_transform([pred_idx])[0]

    # ── Bi-LSTM: predict next move (ONNX) ────────
    next_moves = []
    if _CACHE.get("lstm") is not None:
        click.echo(click.style("  [5/4] Predicting next move (Bi-LSTM)...", fg="bright_black"))
        try:
            SEQ_LEN   = 5
            feat_cols = _CACHE["feature_cols"]
            single    = np.array([features.get(c, 0.0) for c in feat_cols],
                                 dtype=np.float32)
            X_seq     = _CACHE["lstm_scaler"].transform(
                            np.tile(single, (SEQ_LEN, 1))
                        ).reshape(1, SEQ_LEN, len(feat_cols)).astype(np.float32)

            sess      = _CACHE["lstm"]
            inp_name  = sess.get_inputs()[0].name
            probs     = sess.run(None, {inp_name: X_seq})[0][0]
            top2_idx  = np.argsort(probs)[::-1][:2]
            classes   = _CACHE["lstm_le"].classes_
            next_moves = [(classes[i], float(probs[i])) for i in top2_idx]
        except Exception as e:
            click.echo(click.style(f"  [LSTM] skipped: {e}", fg="bright_black"))
    click.echo()

    # ── Adjust anomaly score ─────────────────────
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

    label, color, icon = _threat_label(anomaly_score)
    baseline            = _CACHE["baseline"]

    bar_filled = int(anomaly_score * 30)
    bar = (click.style("█" * bar_filled, fg=color) +
           click.style("░" * (30 - bar_filled), fg="bright_black"))

    # ── Main output ──────────────────────────────
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

    # ── Next move prediction ─────────────────────
    if next_moves:
        click.echo(f"\n  {click.style('Predicted Next Move (Bi-LSTM):', fg='bright_black')}")
        for rank, (cls, prob) in enumerate(next_moves):
            bar_w    = int(prob * 30)
            prob_bar = (click.style("█" * bar_w,        fg="magenta") +
                        click.style("░" * (30 - bar_w), fg="bright_black"))
            click.echo(f"    #{rank+1}  {cls:<20} {prob_bar}  {prob:.1%}")

    # ── MITRE ATT&CK ─────────────────────────────
    mitre_techs = MITRE_MAP.get(attack_type, [])
    if mitre_techs:
        click.echo(f"\n  {click.style('MITRE ATT&CK:', fg='bright_black')}")
        for tid, tname in mitre_techs:
            click.echo(f"    {click.style(tid, fg='magenta')}  {tname}")

    # ── Flow feature breakdown ────────────────────
    click.echo(f"\n  {click.style('Flow Feature Breakdown:', fg='bright_black')}")
    for lbl, val in [
        ("Target port",         features["dst_port"]),
        ("Packet count",        features["packet_count"]),
        ("Flow duration (sec)", features["flow_duration_sec"]),
        ("Bytes per packet",    features["bytes_per_packet"]),
        ("SYN ratio",           features["syn_ratio"]),
        ("RST ratio",           features["rst_ratio"]),
        ("SYN scan detected",   features["is_syn_scan"]),
    ]:
        click.echo(f"    {lbl:<26}: "
                   f"{click.style(str(round(val, 3)), fg='yellow')}")

    # ── Hornet40 baseline ─────────────────────────
    click.echo(f"\n  {click.style('Hornet40 Geo Baseline:', fg='bright_black')}")
    click.echo(f"    Normal range  : 0 — "
               f"{click.style(str(round(baseline['threshold'])), fg='green')} flows/hr")
    click.echo(f"    Global mean   : "
               f"{click.style(str(round(baseline['mean'], 1)), fg='white')} flows/hr")
    click.echo(f"\n  {'─'*54}\n")



def _run_heuristic(ip: str):
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