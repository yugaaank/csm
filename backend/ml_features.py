"""Feature extraction for ML anomaly detection.

Features (4 dims) from (event, recent_events):
  0. count_60s_per_user  — ops by same user in last 60s (like Rule 5)
  1. hour_of_day         — 0-23 normalized 0-1
  2. is_off_hours        — 1 if 0-5 or 22-23 else 0
  3. ip_changed          — 1 if source_ip differs from last 5 events by same user
  4. service_diversity   — distinct services in window / window size (0-1)

All features are numeric, no scaling needed for IsolationForest but
kept 0-1 range where sensible.
"""
from datetime import datetime, timezone, timedelta
from collections import Counter

from .config import EXCESSIVE_API_WINDOW_SEC


def _parse_ts(ts_str: str) -> datetime:
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def featurize(event: dict, recent_events: list) -> list[float]:
    user = event.get("user") or "unknown"
    ts_str = event.get("timestamp") or ""
    now = _parse_ts(ts_str) if ts_str else datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=EXCESSIVE_API_WINDOW_SEC)

    # count + window slice per user
    window_events = []
    for e in recent_events:
        try:
            ts = _parse_ts(e["timestamp"])
        except Exception:
            continue
        if e.get("user") == user and window_start <= ts <= now:
            window_events.append(e)

    count_60s = len(window_events)

    # hour 0-23 normalized
    hour = now.hour / 23.0 if 23 else 0
    is_off_hours = 1.0 if now.hour in (0, 1, 2, 3, 4, 5, 22, 23) else 0.0

    # ip_changed: compare to last 5 events of same user (excluding current if in recent)
    user_history = [e for e in recent_events if e.get("user") == user]
    # sort by timestamp, take last 5 before current
    user_history = sorted(user_history, key=lambda x: x.get("timestamp", ""))[-6:-1]
    cur_ip = event.get("source_ip") or "127.0.0.1"
    if not user_history:
        ip_changed = 0.0
    else:
        ips = {e.get("source_ip", "127.0.0.1") for e in user_history}
        ip_changed = 0.0 if cur_ip in ips else 1.0

    # service diversity in window
    if not window_events:
        diversity = 0.0
    else:
        distinct = len({e.get("service", "UNKNOWN") for e in window_events})
        diversity = distinct / len(window_events)

    return [float(count_60s), float(hour), float(is_off_hours), float(ip_changed), float(diversity)]


FEATURE_NAMES = ["count_60s", "hour_norm", "is_off_hours", "ip_changed", "service_diversity"]
FEATURE_DIM = len(FEATURE_NAMES)
