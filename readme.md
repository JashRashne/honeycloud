# README

# 🍯 HoneyCloud

> _Adaptive cloud honeypot platform — deploy decoys, monitor attacks in real-time, and score threats with ML._

[![CI](https://github.com/JashRashne/honeycloud/actions/workflows/ci.yml/badge.svg)](https://github.com/JashRashne/honeycloud/actions)

![PyPI version](https://badge.fury.io/py/honeycloud.svg)

![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Install

```bash
pip install honeycloud
```

---

## Commands

### Deploy a honeypot

```bash
honeycloud deploy --mock          # No Docker required — demo mode
honeycloud deploy --port 8022     # Real Cowrie SSH honeypot via Docker
```

![Screenshot 2026-03-12 at 9.35.44 AM.png](data/images/Screenshot%202026-03-12%20at%209.35.44%20AM.png)

![Screenshot 2026-03-12 at 9.36.09 AM.png](data/images/Screenshot%202026-03-12%20at%209.36.09%20AM.png)

---

### Monitor live attacks

```bash
honeycloud monitor               # replay captured session
honeycloud monitor --live        # continuous live stream
```

![Screenshot 2026-03-12 at 9.36.54 AM.png](data/images/Screenshot%202026-03-12%20at%209.36.54%20AM.png)

![Screenshot 2026-03-12 at 9.37.33 AM.png](data/images/Screenshot%202026-03-12%20at%209.37.33%20AM.png)

---

### Score an IP address

```bash
honeycloud score 45.33.32.156
honeycloud score 192.168.1.1
```

![Screenshot 2026-03-12 at 9.37.58 AM.png](data/images/Screenshot%202026-03-12%20at%209.37.58%20AM.png)

![Screenshot 2026-03-12 at 9.38.20 AM.png](data/images/Screenshot%202026-03-12%20at%209.38.20%20AM.png)

## Architecture

[coming soon...]

## Datasets

Will be trained and validated on four real-world honeypot capture datasets as of yet:

1. **CIC-Honeynet** — T-Pot, 20+ honeypot types
2. **Hornet-40** — 8 global cities, 40 days, NetFlow (Valeros, 2021)
3. **Dionaea/AWS** — 451k+ protocol-level attack events
4. **AWS Geo Honeypot** — geo-tagged attack corpus

## License

MIT
