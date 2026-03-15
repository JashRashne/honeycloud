import json
from datetime import datetime

MITRE_MAP = {
    "ls":              ("T1083",    "File and Directory Discovery"),
    "whoami":          ("T1033",    "System Owner/User Discovery"),
    "cat /etc/passwd": ("T1003.008","OS Credential Dumping: /etc/passwd"),
    "wget":            ("T1105",    "Ingress Tool Transfer"),
    "curl":            ("T1105",    "Ingress Tool Transfer"),
    "uname":           ("T1082",    "System Information Discovery"),
    "ps":              ("T1057",    "Process Discovery"),
    "netstat":         ("T1049",    "System Network Connections Discovery"),
    "chmod":           ("T1222",    "File/Directory Permissions Modification"),
    "cd /root":        ("T1083",    "File and Directory Discovery"),
}

def parse_cowrie_log(filepath: str) -> list:
    """Parse cowrie.json and return structured attack events."""
    events = []
    sessions = {}

    with open(filepath, 'r') as f:
        for line in f:
            try:
                event = json.loads(line.strip())
                eid = event.get("eventid", "")
                session = event.get("session", "unknown")
                src_ip = event.get("src_ip", "unknown")
                ts = event.get("timestamp", "")

                # track session state
                if session not in sessions:
                    sessions[session] = {
                        "src_ip": src_ip,
                        "commands": [],
                        "credentials": [],
                        "start_time": ts,
                        "duration": 0,
                        "hassh": None,
                    }

                if eid == "cowrie.client.kex":
                    sessions[session]["hassh"] = event.get("hassh")

                elif eid == "cowrie.login.success":
                    sessions[session]["credentials"].append({
                        "username": event.get("username"),
                        "password": event.get("password"),
                    })
                    events.append({
                        "type":      "login_success",
                        "src_ip":    src_ip,
                        "username":  event.get("username"),
                        "password":  event.get("password"),
                        "session":   session,
                        "timestamp": ts,
                        "mitre_id":  "T1110.001",
                        "mitre_name":"Brute Force: Password Guessing",
                        "severity":  "HIGH",
                    })

                elif eid == "cowrie.login.failed":
                    events.append({
                        "type":      "login_failed",
                        "src_ip":    src_ip,
                        "username":  event.get("username"),
                        "password":  event.get("password"),
                        "session":   session,
                        "timestamp": ts,
                        "mitre_id":  "T1110.001",
                        "mitre_name":"Brute Force: Password Guessing",
                        "severity":  "MEDIUM",
                    })

                elif eid == "cowrie.command.input":
                    cmd = event.get("input", "").strip()
                    sessions[session]["commands"].append(cmd)

                    # look up MITRE tag
                    mitre_id, mitre_name = ("T1059", "Command and Scripting Interpreter")
                    for pattern, (mid, mname) in MITRE_MAP.items():
                        if pattern in cmd:
                            mitre_id, mitre_name = mid, mname
                            break

                    events.append({
                        "type":       "command",
                        "src_ip":     src_ip,
                        "command":    cmd,
                        "session":    session,
                        "timestamp":  ts,
                        "mitre_id":   mitre_id,
                        "mitre_name": mitre_name,
                        "severity":   "HIGH" if any(
                            x in cmd for x in ["wget","curl","chmod","/etc/passwd","passwd"]
                        ) else "MEDIUM",
                    })

                elif eid == "cowrie.session.closed":
                    sessions[session]["duration"] = float(
                        event.get("duration", 0)
                    )

            except json.JSONDecodeError:
                continue

    return events, sessions


def print_events(events: list):
    """Pretty print parsed events like honeycloud monitor."""
    print("\n  🍯 HoneyCloud — Cowrie Session Analysis")
    print("  " + "─" * 60)

    for e in events:
        ts = e["timestamp"][:19].replace("T", " ")
        sev_colors = {
            "CRITICAL": "\033[91m", "HIGH": "\033[93m",
            "MEDIUM": "\033[96m",   "LOW":  "\033[97m"
        }
        color = sev_colors.get(e["severity"], "\033[97m")
        reset = "\033[0m"

        if e["type"] == "login_success":
            print(f"\n  {ts}  {color}[{e['severity']:>8}]{reset}  {e['src_ip']}")
            print(f"             MITRE: {e['mitre_id']}  {e['mitre_name']}")
            print(f"             Credential captured: {e['username']} / {e['password']}")

        elif e["type"] == "login_failed":
            print(f"\n  {ts}  {color}[{e['severity']:>8}]{reset}  {e['src_ip']}")
            print(f"             MITRE: {e['mitre_id']}  {e['mitre_name']}")
            print(f"             Failed attempt: {e['username']} / {e['password']}")

        elif e["type"] == "command":
            print(f"\n  {ts}  {color}[{e['severity']:>8}]{reset}  {e['src_ip']}")
            print(f"             MITRE: {e['mitre_id']}  {e['mitre_name']}")
            print(f"             CMD: {e['command']}")

    print(f"\n  {'─'*60}")
    print(f"  Total events: {len(events)}")
    print(f"  Login successes: {sum(1 for e in events if e['type']=='login_success')}")
    print(f"  Commands captured: {sum(1 for e in events if e['type']=='command')}\n")


if __name__ == "__main__":
    import sys
    log_path = sys.argv[1] if len(sys.argv) > 1 else "data/cowrie-logs/cowrie.json"
    events, sessions = parse_cowrie_log(log_path)
    print_events(events)

    print("\n  📊 Session Summary:")
    for sid, s in sessions.items():
        print(f"\n  Session: {sid}")
        print(f"    IP: {s['src_ip']}")
        print(f"    Duration: {s['duration']}s")
        print(f"    HASSH: {s['hassh']}")
        print(f"    Commands: {s['commands']}")
        print(f"    Credentials tried: {s['credentials']}")