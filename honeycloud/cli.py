import click
from honeycloud import deploy as deploy_mod
from honeycloud import monitor as monitor_mod  
from honeycloud import score as score_mod

@click.group()
@click.version_option(version="0.1.6", prog_name="honeycloud")
def main():
    """
    \b
    🍯 HoneyCloud — Adaptive Cloud Honeypot Platform
    Detect. Deceive. Attribute.
    """
    pass

@main.command()
@click.option("--mock", is_flag=True, default=False, help="Run in mock mode (no Docker required)")
@click.option("--port", default=2222, show_default=True, help="Port to expose the honeypot on")
def deploy(mock, port):
    """Deploy a HoneyCloud honeypot instance."""
    deploy_mod.run(mock=mock, port=port)

@main.command()
@click.option("--live", is_flag=True, default=False, help="Tail log in real-time (like tail -f)")
@click.option("--log",  default="data/cowrie-logs/cowrie.json", show_default=True,
              help="Path to cowrie.json log file")
def monitor(live, log):
    """Monitor honeypot events — replay or stream in real-time."""
    monitor_mod.run(live=live, log_path=log)

@main.command()
@click.argument("ip")
def score(ip):
    """Score an IP address for threat level using ML anomaly detection."""
    score_mod.run(ip)