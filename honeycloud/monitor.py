import time
import random
import click
from datetime import datetime

# MITRE ATT&CK technique mappings per protocol/behaviour
MITRE_MAP = {
    "ssh_bruteforce":    ("T1110.001", "Brute Force: Password Guessing"),
    "ssh_login":         ("T1078",     "Valid Accounts"),
    "smb_probe":         ("T1021.002", "Remote Services: SMB/Windows Admin Shares"),
    "ftp_probe":         ("T1071.002", "Application Layer Protocol: File Transfer"),
    "http_scan":         ("T1190",     "Exploit Public-Facing Application"),
    "db_probe":          ("T1505.001", "Server Software Component: SQL"),
    "port_scan":         ("T1046",     "Network Service Discovery"),
    "c2_beacon":         ("T1071.001", "Application Layer Protocol: Web Protocols"),
    "log4shell":         ("T1190",     "Exploit Public-Facing Application"),
    "rdp_bruteforce":    ("T1110.003", "Brute Force: Password Spraying"),
}

SEVERITY_COLOR = {
    "CRITICAL": "red",
    "HIGH":     "yellow",
    "MEDIUM":   "cyan",
    "LOW":      "white",
}

MOCK_EVENTS = [
    {"type": "ssh_bruteforce",  "src": "45.33.32.156",   "country": "RU", "port": 22,   "severity": "HIGH",     "detail": "847 attempts in 6 min | creds: root/admin123"},
    {"type": "port_scan",       "src": "198.20.69.74",   "country": "CN", "port": 0,    "severity": "MEDIUM",   "detail": "SYN scan across ports 22,80,443,3306,3389"},
    {"type": "smb_probe",       "src": "89.248.165.200", "country": "NL", "port": 445,  "severity": "HIGH",     "detail": "EternalBlue probe detected (MS17-010)"},
    {"type": "http_scan",       "src": "141.98.81.137",  "country": "DE", "port": 80,   "severity": "MEDIUM",   "detail": "GET /.env, /wp-admin, /phpmyadmin"},
    {"type": "log4shell",       "src": "185.220.101.45", "country": "TOR","port": 8080, "severity": "CRITICAL", "detail": "Log4Shell payload in User-Agent header"},
    {"type": "db_probe",        "src": "103.75.190.1",   "country": "IN", "port": 3306, "severity": "HIGH",     "detail": "MySQL login attempt | user: root, admin, sa"},
    {"type": "c2_beacon",       "src": "92.118.160.17",  "country": "UA", "port": 443,  "severity": "CRITICAL", "detail": "Beacon interval: 60s | encrypted payload"},
    {"type": "rdp_bruteforce",  "src": "179.60.150.33",  "country": "BR", "port": 3389, "severity": "HIGH",     "detail": "Password spray: 1200 attempts, 43 usernames"},
    {"type": "ftp_probe",       "src": "77.247.110.53",  "country": "SE", "port": 21,   "severity": "LOW",      "detail": "Anonymous FTP login attempt"},
    {"type": "ssh_login",       "src": "45.33.32.156",   "country": "RU", "port": 22,   "severity": "CRITICAL", "detail": "Successful login with planted credential! Engaged."},
]

def _format_event(event: dict) -> str:
    ts = datetime.now().strftime("%H:%M:%S")
    technique_id, technique_name = MITRE_MAP.get(event["type"], ("T????", "Unknown"))
    sev = event["severity"]
    sev_str = click.style(f"[{sev:>8}]", fg=SEVERITY_COLOR.get(sev, "white"), bold=True)
    mitre_str = click.style(f"{technique_id}", fg="magenta")
    src_str = click.style(event["src"], fg="cyan")
    flag = f"[{event['country']}]"

    lines = [
        f"\n  \033[90m{ts}\033[0m {sev_str} {flag} {src_str}  →  port \033[93m{event['port']}\033[0m",
        f"           \033[90mMITRE:\033[0m {mitre_str}  {technique_name}",
        f"           \033[90mDetail:\033[0m {event['detail']}",
    ]
    return "\n".join(lines)

def _print_header():
    click.echo(click.style("\n  🍯 HoneyCloud — Live Threat Monitor", fg="yellow", bold=True))
    click.echo(click.style("  ─────────────────────────────────────────────────────────────", fg="white"))
    click.echo(click.style("  Timestamp  Severity   Origin  Source IP              MITRE", fg="bright_black"))
    click.echo(click.style("  ─────────────────────────────────────────────────────────────", fg="white"))

def run(live: bool = False):
    _print_header()

    if live:
        _run_live_simulation()
    else:
        _run_sample()

def _run_live_simulation():
    click.echo(click.style("  [LIVE MODE] Streaming attack events. Press Ctrl+C to stop.\n", fg="green"))
    try:
        while True:
            event = random.choice(MOCK_EVENTS)
            click.echo(_format_event(event))
            time.sleep(random.uniform(0.8, 3.5))
    except KeyboardInterrupt:
        click.echo(click.style("\n\n  Monitor stopped. Run `honeycloud score <ip>` to profile an attacker.\n", fg="yellow"))

def _run_sample():
    click.echo(click.style("  [SAMPLE] Replaying captured attack session. Use --live for continuous stream.\n", fg="cyan"))
    for event in MOCK_EVENTS:
        click.echo(_format_event(event))
        time.sleep(0.3)
    click.echo(f"\n  \033[90m{'─'*60}\033[0m")
    click.echo(f"  \033[93mTotal events:\033[0m {len(MOCK_EVENTS)}  |  "
               f"\033[91mCritical:\033[0m {sum(1 for e in MOCK_EVENTS if e['severity']=='CRITICAL')}  |  "
               f"\033[93mHigh:\033[0m {sum(1 for e in MOCK_EVENTS if e['severity']=='HIGH')}\n")
    click.echo("  Run \033[93mhoneycloud monitor --live\033[0m for continuous streaming.\n")
