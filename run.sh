#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
uv pip install -q -r requirements.txt 2>&1 | tail -n 5
echo ">> setup Floci environment"
uv run python scripts/setup_floci.py || echo "setup_floci failed — continuing (Floci may be unreachable)"
echo ">> starting server on :5000"
uv run python -m backend.app
