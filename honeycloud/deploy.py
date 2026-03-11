import time
import subprocess
import sys
import click

COWRIE_IMAGE = "cowrie/cowrie:latest"

BANNER = """
\033[93m
  ██╗  ██╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗ ██████╗██╗      ██████╗ ██╗   ██╗██████╗
  ██║  ██║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗
  ███████║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝ ██║     ██║     ██║   ██║██║   ██║██║  ██║
  ██╔══██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝  ██║     ██║     ██║   ██║██║   ██║██║  ██║
  ██║  ██║╚██████╔╝██║ ╚████║███████╗   ██║   ╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝
  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝    ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝
\033[0m"""

def _check_docker():
    try:
        subprocess.run(["docker", "info"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def run(mock: bool = False, port: int = 2222):
    print(BANNER)
    click.echo(click.style("  🍯 HoneyCloud Deployment Engine", fg="yellow", bold=True))
    click.echo(click.style("  ─────────────────────────────────────────", fg="white"))

    if mock:
        _run_mock(port)
    else:
        _run_docker(port)

def _run_mock(port: int):
    click.echo(f"\n  \033[36m[MOCK MODE]\033[0m Simulating honeypot deployment on port \033[93m{port}\033[0m\n")

    steps = [
        ("Initializing decoy fabric",        0.6),
        ("Configuring SSH emulation layer",  0.8),
        ("Loading fake filesystem artifacts", 0.5),
        ("Planting credential lures",         0.4),
        ("Arming Isolation Forest baseline",  0.7),
        ("Starting event ingestion pipeline", 0.6),
        ("Registering with HoneyCloud grid",  0.5),
    ]

    for step, delay in steps:
        click.echo(f"  \033[32m✔\033[0m  {step}...", nl=False)
        time.sleep(delay)
        click.echo(f"\033[32m done\033[0m")

    click.echo(f"""
  \033[92m╔══════════════════════════════════════════════════╗
  ║   HoneyCloud Honeypot: ACTIVE                    ║
  ║   Listening on  : 0.0.0.0:{port} (SSH emulation)   ║
  ║   Protocol      : Cowrie SSH/Telnet (mock)        ║
  ║   ML Pipeline   : Anomaly Transformer [ARMED]     ║
  ║   MITRE Tagging : ATT&CK v14 [ENABLED]            ║
  ║   STIX Export   : MISP feed [STANDBY]             ║
  ╚══════════════════════════════════════════════════╝\033[0m

  Run \033[93mhoneycloud monitor --live\033[0m to watch incoming attacks.
""")

def _run_docker(port: int):
    if not _check_docker():
        click.echo(click.style(
            "\n  ✗ Docker not found. Use --mock to run without Docker.\n",
            fg="red"
        ))
        sys.exit(1)

    click.echo(f"\n  Pulling Cowrie honeypot image: \033[93m{COWRIE_IMAGE}\033[0m\n")
    try:
        subprocess.run(["docker", "pull", COWRIE_IMAGE], check=True)
        click.echo(f"\n  Launching Cowrie on port \033[93m{port}\033[0m...\n")
        subprocess.run([
            "docker", "run", "-d",
            "--name", "honeycloud-cowrie",
            "--network", "none",          # zero egress — attackers can't pivot out
            "-p", f"{port}:2222",
            COWRIE_IMAGE
        ], check=True)
        click.echo(click.style(f"\n  ✔  Honeypot live on port {port}. Run: honeycloud monitor\n", fg="green"))
    except subprocess.CalledProcessError as e:
        click.echo(click.style(f"\n  ✗  Docker error: {e}\n  Try --mock mode.\n", fg="red"))
        sys.exit(1)
