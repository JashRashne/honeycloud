import click
from honeycloud import deploy, monitor, score

@click.group()
@click.version_option(version="0.1.0", prog_name="honeycloud")
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
def deploy_cmd(mock, port):
    """Deploy a HoneyCloud honeypot instance."""
    deploy.run(mock=mock, port=port)

@main.command()
@click.option("--live", is_flag=True, default=False, help="Simulate live incoming attacks")
def monitor_cmd(live):
    """Monitor honeypot events in real-time."""
    monitor.run(live=live)

@main.command()
@click.argument("ip")
def score_cmd(ip):
    """Score an IP address for threat level using ML anomaly detection."""
    score.run(ip)

main.add_command(deploy_cmd, name="deploy")
main.add_command(monitor_cmd, name="monitor")
main.add_command(score_cmd, name="score")
