# Cloud Security Monitor — Floci

A small but functional cloud security monitor that uses **Floci** as a local AWS-compatible environment. Collects cloud activity, detects 5 security threats with rule-based detection, scores risk, maps to MITRE ATT&CK, and displays everything in a Notion-inspired dashboard.

Built for a college project demo — backend, cloud integration, event processing, security analysis, database, and frontend in one runnable prototype.

```
Floci → Cloud Activity → Event Collector → Detection Engine → Risk Scoring → MITRE → SQLite → Dashboard
```

## Features

- **Floci integration** via `boto3` (S3 + IAM) — real AWS API calls against `http://localhost:4566`, not mocked data
- **Event collector** normalizes every operation to `{timestamp, user, service, action, resource, source_ip, status}` and stores history in SQLite
- **5 detection rules**
  | # | Rule | Severity | Score | MITRE |
  |---|------|----------|-------|-------|
  | 1 | Public S3 Bucket (`PutBucketAcl` / `PutBucketPolicy` + Floci ACL check) | HIGH | 85 | T1530 Data from Cloud Storage |
  | 2 | IAM Policy Change (`PutUserPolicy`, `AttachUserPolicy` etc., flags `*` / `AdministratorAccess`) | HIGH | 90 | T1098 Account Manipulation |
  | 3 | New Access Key (`CreateAccessKey`) | MEDIUM | 55 | T1098.001 Additional Cloud Credentials |
  | 4 | S3 Object Deletion (`DeleteObject`) | MEDIUM | 50 | T1485 Data Destruction |
  | 5 | Excessive API Activity (>20 ops / 60s per user, configurable) | HIGH | 80 | T1078 Valid Accounts |
- **Risk scoring** 0–100 (`LOW 0-39`, `MEDIUM 40-69`, `HIGH 70-89`, `CRITICAL 90-100`), overall score = `100 - total_open_risk/5`
- **MITRE mapping + recommendations** per alert, no auto-remediation
- **Dashboard** — Notion paper #F6F5F4 + blue pill #0075DE, security score, counts by severity, recent activity (filter service/user/action), alerts (filter severity/status, detail drawer), status transitions `OPEN → REVIEWED → RESOLVED`, and event timeline (last 50)

## Architecture

```
Floci AWS (S3, IAM)  ──boto3──▶  Flask (backend/app.py)
                                    ├─ floci_client.py  — boto3 clients + is_public check
                                    ├─ event_collector.py — normalize + store + trigger detect
                                    ├─ detector.py — 5 rules
                                    ├─ risk_engine.py — 0–100
                                    ├─ mitre.py — technique + recommendation
                                    └─ database.py — SQLite (events, alerts)
                                          │
                                          ▼
                                   React Vite (frontend/src/App.jsx)
                                   Notion theme — index.css (#F6F5F4 + #0075DE + Inter tight)
                                   proxy /api → :5000 (vite.config.js)
```

## Project Structure

```
backend/
  app.py              Flask API + static serving (dist/ if built else frontend/)
  config.py           endpoint, region, thresholds, DB path
  database.py         SQLite init / insert / query
  floci_client.py     boto3 S3/IAM helpers
  event_collector.py  normalize + collect()
  detector.py         5 rules
  risk_engine.py      scoring
  mitre.py            ATT&CK mapping
  models.py           re-exports
frontend/             Vite + React 19
  vite.config.js      proxy /api → http://localhost:5000
  index.html
  src/
    App.jsx           Notion dashboard
    main.jsx
    index.css         Black+Gold design system
  public/
  dist/               built output (gitignored, served by Flask in prod)
scripts/
  setup_floci.py      creates buckets/users/policies/keys
  demo.py             demo scenario via API or direct
```

## Prerequisites

- Python 3.10+, [uv](https://docs.astral.sh/uv/), Docker (for Floci), `floci` CLI
- Node 18+ + [bun](https://bun.sh/) (for frontend, `npm` also works)

```bash
floci --version   # 0.2.1+
python3 --version
uv --version
bun --version
```

## Quick Start

### Backend only (API at :5000, serves built frontend if present)

```bash
# 1. Start local AWS
floci start
floci status          # Reachable: yes, Endpoint: http://localhost:4566

# 2. Install backend
uv venv .venv
uv pip install -r requirements.txt

# 3. Create Floci test env (3 buckets incl. 1 public, 3 users)
uv run python scripts/setup_floci.py

# 4. Run backend
uv run python -m backend.app   # http://localhost:5000
# or ./run.sh
```

### Frontend

**Prod** — Flask serves `frontend/dist`:
```bash
cd frontend
bun install
bun run build        # → dist/
cd .. && uv run python -m backend.app  # open http://localhost:5000
```

**Dev** — Vite HMR with proxy:
```bash
# terminal 1 — backend
uv run python -m backend.app  # :5000
# terminal 2 — frontend
cd frontend && bun install && bun run dev  # :5173 → proxies /api → :5000
# open http://localhost:5173
```

## Demo Scenario

Dashboard → **Run Demo Scenario** (gold button) or:

```bash
curl -X POST http://localhost:5000/api/simulate -H 'Content-Type: application/json' -d '{"user":"alice"}'
# or offline
uv run python scripts/demo.py
```

Sequence:

1. `CreateBucket` → `PutObject` → `GetObject`
2. `PutBucketAcl public-read` → **Rule 1 HIGH — Public S3 Bucket (85)**
3. `CreateAccessKey` → **Rule 3 MEDIUM — New Access Key (55)**
4. `PutUserPolicy AdministratorAccess` → **Rule 2 HIGH — IAM Policy Changed (90)**
5. `DeleteObject` → **Rule 4 MEDIUM — S3 Object Deleted (50)**
6. Burst 25× `GetObject` → **Rule 5 HIGH — Excessive API Activity (80)**

Check `Floci event → /api/collect → detector → alert → dashboard` in the API or UI. Click an alert for MITRE + recommendation + status change. Polls every 8s, `Refresh` forces reload.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/overview` | `security_score`, `total_events`, `total_alerts`, `by_severity` |
| GET | `/api/events?service=&user=&action=&limit=100` | Recent events |
| GET | `/api/alerts?severity=&status=&date=` | Alerts |
| GET | `/api/alerts/:id` | Alert + linked event |
| PATCH | `/api/alerts/:id` | `{"status":"OPEN"\|"REVIEWED"\|"RESOLVED"}` |
| POST | `/api/collect` | Single event or array |
| POST | `/api/simulate` | Runs full demo against Floci |
| GET | `/api/timeline` | Last 50 events chronological |

Event shape:

```json
{
  "timestamp": "2026-09-03T00:00:00+00:00",
  "user": "alice",
  "service": "S3",
  "action": "GetObject",
  "resource": "my-bucket/hello.txt",
  "source_ip": "127.0.0.1",
  "status": "success"
}
```

Alert shape:

```json
{
  "title": "IAM Policy Changed",
  "description": "Administrator-level permissions were added...",
  "severity": "HIGH",
  "risk_score": 90,
  "mitre_technique": "T1098 - Account Manipulation",
  "recommendation": "Review the new permissions...",
  "status": "OPEN"
}
```

## Configuration

Env vars:

```
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
CSM_DB=./csm.db
CSM_EXCESSIVE_THRESHOLD=20
CSM_EXCESSIVE_WINDOW=60
PORT=5000
```

Frontend dev proxy: `frontend/vite.config.js` → `server.proxy['/api'] = 'http://localhost:5000'`

## Manual Testing

```bash
# create a public bucket finding directly
curl -X POST http://localhost:5000/api/collect \
  -H 'Content-Type: application/json' \
  -d '{"user":"bob","service":"S3","action":"PutBucketAcl","resource":"my-bucket"}'

curl http://localhost:5000/api/alerts | jq
```

If demo shows nothing: ensure backend is running (`curl http://localhost:5000/api/overview`), `floci status` reachable, hard refresh `Ctrl+Shift+R`, check `F12 → Network → /api/simulate` for 500, `rm csm.db` for clean slate.

## Tech Stack

Floci (LocalStack-compatible) · Python Flask + Flask-Cors · boto3 · SQLite · React 19 + Vite + bun · Notion Design System (#F6F5F4 + #0075DE + paper calm). No ML, minimal deps.

## License

MIT
