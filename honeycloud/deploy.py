import time
import subprocess
import sys
from typing import Optional
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
        return True, None
    except FileNotFoundError:
        return False, "Docker is not installed or not in PATH."
    except subprocess.CalledProcessError:
        return False, "Docker is installed but the daemon is not running. Please start Docker Desktop."

def run(mock: bool = False, port: int = 2222):
    print(BANNER)
    click.echo(click.style("  🍯 HoneyCloud Deployment Engine", fg="yellow", bold=True))
    click.echo(click.style("  ─────────────────────────────────────────", fg="white"))

    if mock:
        _run_mock(port)
    else:
        ok, err = _check_docker()
        if not ok:
            click.echo(click.style(f"\n  ✗ {err}\n  Use --mock to run without Docker.\n", fg="red"))
            sys.exit(1)
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

def _container_exists() -> Optional[str]:
    """Returns container status ('running', 'exited', etc.) or None if it doesn't exist."""
    result = subprocess.run(
        ["docker", "inspect", "--format", "{{.State.Status}}", "honeycloud-cowrie"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        return result.stdout.strip()
    return None

def _run_docker(port: int):
    status = _container_exists()

    if status == "running":
        click.echo(click.style(
            "\n  ✔  Honeypot is already running. Run: honeycloud monitor\n", fg="green"
        ))
        return

    if status == "exited":
        click.echo(f"\n  Restarting existing container on port \033[93m{port}\033[0m...\n")
        try:
            subprocess.run(["docker", "start", "honeycloud-cowrie"], check=True)
            click.echo(click.style(f"\n  ✔  Honeypot restarted on port {port}. Run: honeycloud monitor\n", fg="green"))
        except subprocess.CalledProcessError as e:
            click.echo(click.style(f"\n  ✗  Docker error: {e}\n", fg="red"))
            sys.exit(1)
        return

    # No container exists yet — fresh deploy
    click.echo(f"\n  Pulling Cowrie honeypot image: \033[93m{COWRIE_IMAGE}\033[0m\n")
    try:
        subprocess.run(["docker", "pull", COWRIE_IMAGE], check=True)
        click.echo(f"\n  Launching Cowrie on port \033[93m{port}\033[0m...\n")
        
        # create local log dir
        import os
        log_dir = os.path.join(os.getcwd(), "data", "cowrie-logs")
        os.makedirs(log_dir, exist_ok=True)

        import platform
        network_args = ["--network", "none"] if platform.system() == "Linux" else []

        subprocess.run([
            "docker", "run", "-d",
            "--name", "honeycloud-cowrie",
            *network_args,
            "-p", f"{port}:2222",
            "-v", f"{log_dir}:/cowrie/cowrie-git/var/log/cowrie",
            COWRIE_IMAGE
        ], check=True)

        click.echo(click.style(f"\n  ✔  Honeypot live on port {port}. Run: honeycloud monitor\n", fg="green"))
    except subprocess.CalledProcessError as e:
        click.echo(click.style(f"\n  ✗  Docker error: {e}\n  Try --mock mode.\n", fg="red"))
        sys.exit(1)
