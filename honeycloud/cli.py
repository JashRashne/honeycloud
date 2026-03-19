import click
from honeycloud import deploy as deploy_mod
from honeycloud import monitor as monitor_mod
from honeycloud import score as score_mod

@click.group()
@click.version_option(version="0.1.8", prog_name="honeycloud")
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

@main.command()
@click.option("--host",    default="0.0.0.0",  show_default=True, help="Bind host")
@click.option("--port",    default=8000,        show_default=True, help="Bind port")
@click.option("--reload",  is_flag=True, default=False,            help="Auto-reload on code changes (dev only)")
@click.option("--workers", default=1,           show_default=True, help="Number of worker processes (ignored if --reload)")
def serve(host, port, reload, workers):
    """Start the HoneyCloud API server (FastAPI + uvicorn)."""
    try:
        import uvicorn
    except ImportError:
        click.echo("❌  uvicorn is not installed. Run: pip install 'uvicorn[standard]'", err=True)
        raise SystemExit(1)

    import sys
    import os

    # Ensure the project root is on sys.path so uvicorn's subprocess
    # can import `api.main` regardless of where the command is run from.
    project_root = os.getcwd()
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    click.echo(f"🚀  Starting HoneyCloud API on http://{host}:{port}")
    click.echo(f"    reload={reload}  workers={1 if reload else workers}")
    click.echo(f"    Docs → http://{'localhost' if host == '0.0.0.0' else host}:{port}/docs")

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=reload,
        workers=1 if reload else workers,
        # app_dir is added to sys.path in the subprocess so
        # `api.main` resolves correctly with --reload
        app_dir=project_root,
        reload_dirs=[project_root] if reload else None,
    )

@main.command()
@click.option("--log-path",   default=None,       help="Path to cowrie.json (auto-detected if omitted)")
@click.option("--db-url",     default=None,       help="PostgreSQL URL (uses HONEYCLOUD_DB_URL env var if omitted)")
@click.option("--dry-run",    is_flag=True, default=False, help="Print events without writing to DB")
@click.option("--from-start", is_flag=True, default=False, help="Reprocess entire existing log file on startup")
def collect(log_path, db_url, dry_run, from_start):
    """Tail cowrie.json, score events, and write to PostgreSQL."""
    import os
    import sys

    # Build argv so collector.main() picks up the right args
    # (collector uses argparse internally)
    argv = []
    if log_path:
        argv += ["--log-path", log_path]
    if db_url:
        argv += ["--db-url", db_url]
    if dry_run:
        argv += ["--dry-run"]
    if from_start:
        argv += ["--from-start"]

    # Patch sys.argv so argparse inside collector sees our flags
    sys.argv = ["honeycloud collect"] + argv

    from honeycloud.collector import main as collector_main
    collector_main()