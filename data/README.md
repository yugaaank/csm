# Data — Simulation vs Real

This project simulates AWS CloudTrail via **Floci** (local AWS). Real logs never leave AWS — here we fake them.

**Files:**
- `generate_labeled.py` → `labeled.json` (500 events, 400 benign / 100 attacks, 5 attack types). Ground truth `label` breaks the "train on own attacks" circle. Run `uv run python data/generate_labeled.py` to regenerate.
- `sample_cloudtrail.json` — 20 events in real `CloudTrail` format (`eventTime`, `eventSource`, `userIdentity`...). Import via `uv run python scripts/import_cloudtrail.py data/sample_cloudtrail.json`.
- `labeled.json` — committed, used by `scripts/evaluate.py` to compute precision/recall vs rules.

**Real-world swap:**
Replace `Floci + simulate` with `aws cloudtrail lookup-events --output json > dump.json` then `import_cloudtrail.py dump.json`. Same `collect()` path, no code change. For production, poll `CloudTrail Lake` or `S3 → SQS`.
