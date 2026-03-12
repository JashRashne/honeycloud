# 🍯 HoneyCloud

> _Adaptive cloud honeypot platform — deploy decoys, monitor attacks in real-time, and score threats with ML._

[![CI](https://github.com/JashRashne/honeycloud/actions/workflows/ci.yml/badge.svg)](https://github.com/JashRashne/honeycloud/actions)
[![PyPI version](https://badge.fury.io/py/honeycloud.svg)](https://pypi.org/project/honeycloud/)
![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

HoneyCloud is a CLI tool that deploys a real SSH honeypot (via [Cowrie](https://github.com/cowrie/cowrie) + Docker), monitors incoming attack events with MITRE ATT&CK tagging, and scores attacker IPs using a lightweight Isolation Forest anomaly detector.

---

## Install

```bash
pip install honeycloud
```

---

## Commands

### `honeycloud deploy`

Deploys a Cowrie SSH honeypot. Two modes:

```bash
honeycloud deploy --mock          # Simulated deploy — no Docker required
honeycloud deploy                 # Real Cowrie honeypot via Docker (port 2222)
honeycloud deploy --port 8022     # Real Cowrie honeypot on a custom port
```

**Mock mode** — simulates the deployment pipeline with animated steps, no Docker needed:

![mock-deploy-start](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292148/Screenshot_2026-03-12_at_9.35.44_AM_vldnt5.png)

![mock-deploy-active](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292147/Screenshot_2026-03-12_at_9.36.09_AM_tgl7ml.png)

**Real Docker deploy** — pulls `cowrie/cowrie:latest`, runs it with `--network none` (zero egress so attackers can't pivot out). Re-running the command safely detects if the container already exists:

![docker-deploy-1](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292151/Screenshot_2026-03-12_at_9.47.25_AM_s3dkrg.png)

![docker-deploy-2](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292150/Screenshot_2026-03-12_at_9.47.35_AM_1_zftafa.png)

![docker-deploy-3](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292151/Screenshot_2026-03-12_at_9.47.47_AM_ismm62.png)

---

### `honeycloud monitor`

Streams incoming attack events with severity, source IP, country, target port, and MITRE ATT&CK technique.

```bash
honeycloud monitor               # Replay a captured attack session
honeycloud monitor --live        # Continuous live stream (Ctrl+C to stop)
```

![monitor-sample](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292148/Screenshot_2026-03-12_at_9.36.54_AM_ucioft.png)

![monitor-live](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292148/Screenshot_2026-03-12_at_9.37.33_AM_mvtoom.png)

---

### `honeycloud score <ip>`

Scores an IP address for threat level using a lightweight Isolation Forest anomaly detector. Extracts behavioural features (connection frequency, port entropy, protocol diversity, inter-arrival time) and cross-references known malicious infrastructure (Shodan, Censys, Tor exit nodes).

```bash
honeycloud score 45.33.32.156    # Known SSH bruteforcer → CRITICAL
honeycloud score 192.168.1.1     # Private/internal IP  → LOW
```

![score-critical](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292146/Screenshot_2026-03-12_at_9.37.58_AM_tvy0nf.png)

![score-low](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292149/Screenshot_2026-03-12_at_9.38.20_AM_sywqtt.png)

---

## Tests

10 tests covering CLI end-to-end behaviour and scoring unit logic. Runs on Python 3.9, 3.10, and 3.11 via GitHub Actions CI.

```bash
pip install -e .
pip install pytest
pytest tests/ -v
```

![pytest-local](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292150/Screenshot_2026-03-12_at_9.41.31_AM_mhvkya.png)

![github-actions-ci](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773292446/Screenshot_2026-03-12_at_10.43.57_AM_drxwgx.png)

---

## Architecture

![architecture](https://res.cloudinary.com/dgbgxtsrl/image/upload/v1773316834/PHOTO-2026-03-12-17-15-29_kh6lms.jpg)

**Attacker hits a fake server → event is captured → ML analyzes it → system responds and shares intel.**

### Layer 01 — Deception
Four fake services running as traps — SSH, SMB/FTP, HTTP, and Database. Each is a real-looking decoy powered by tools like Cowrie and Dionaea. When an attacker connects, every action they take is silently logged as a structured JSON event. They think they're attacking a real server. They're not.

### Layer 02 — Intelligence
The JSON events flow into **Kafka** (a high-speed event queue) which feeds **Flink** (a stream processor that cleans, enriches, and geo-tags the data). Flink passes the enriched data into the **3-Layer ML Pipeline** which detects, classifies, and predicts the attack. Output is a **Threat Intel Object** — a structured package of everything known about this attacker.

### Layer 03 — Response
Four things happen simultaneously with that Threat Intel Object:
- **Response Engine** — blocks the IP, morphs the honeypot, fires a SIEM alert
- **Data Storage** — saves everything to PostgreSQL, Redis, and S3
- **Threat Sharing** — exports IOCs to MISP, VirusTotal, AlienVault
- **Dashboard** — updates the live Grafana attack map and kill chain view

### The ML Pipeline
A zoom-in on the intelligence brain:
- **Layer 0** — takes 6 behavioral features per connection as input
- **Layer 1 — Detect** — Isolation Forest + Anomaly Transformer scores how anomalous the event is. Score below 0.5 gets discarded. Above 0.5 moves forward.
- **Layer 2 — Classify** — XGBoost + Random Forest ensemble labels the attack type and tags it to a MITRE ATT&CK technique
- **Layer 3 — Predict** — Bi-LSTM predicts the next attack move. GAT connects related IPs into campaign clusters
- **Layer X — Output** — a clean JSON object with attack type, confidence, MITRE ID, next vector prediction, and campaign ID ready for export

> A raw TCP connection enters Layer 01 and exits Layer X as attributed, classified, predicted threat intelligence.
> The current release implements Layer 01 (Cowrie deploy) and a lightweight Isolation Forest for Layer 1 — Detect. The full pipeline is the planned production architecture.

---

## Datasets

Will be trained and validated on four real-world honeypot capture datasets:

1. **CIC-Honeynet** — T-Pot, 20+ honeypot types
2. **Hornet-40** — 8 global cities, 40 days, NetFlow (Valeros, 2021)
3. **Dionaea/AWS** — 451k+ protocol-level attack events
4. **AWS Geo Honeypot** — geo-tagged attack corpus

---

## License

MIT
