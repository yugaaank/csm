from datetime import datetime, timezone
from .database import insert_event, query, insert_alert
from .detector import detect
from .ml_detector import ml_detect

def normalize_event(raw: dict) -> dict:
    """Normalize to {timestamp, user, service, action, resource, source_ip, status}."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "timestamp": raw.get("timestamp") or now,
        "user": raw.get("user") or raw.get("userName") or raw.get("principal") or "unknown",
        "service": raw.get("service") or raw.get("eventSource", "").split(".")[0].upper() or "UNKNOWN",
        "action": raw.get("action") or raw.get("eventName") or raw.get("actionName") or "Unknown",
        "resource": raw.get("resource") or raw.get("resourceName") or raw.get("bucket") or "",
        "source_ip": raw.get("source_ip") or raw.get("sourceIPAddress") or "127.0.0.1",
        "status": raw.get("status") or ("success" if not raw.get("errorCode") else "failure"),
    }
def collect(raw: dict) -> tuple[int, list]:
    """Store normalized event, run detection, store alerts. Returns (event_id, alerts)."""
    evt = normalize_event(raw)
    event_id = insert_event(evt)
    # recent events for excessive-api check: last window worth
    recent = query("SELECT * FROM events ORDER BY id DESC LIMIT 100")
    # reverse to chronological for detector window logic
    recent = list(reversed(recent))
    alerts = detect(evt, event_id, recent)
    # ML sidecar — additive, never breaks rule path (ponytail: fail-open)
    try:
        ml_alerts = ml_detect(evt, event_id, recent)
        alerts.extend(ml_alerts)
    except Exception:
        pass
    for a in alerts:
        # strip internal keys (_rule, _ml_*)
        a_clean = {k: v for k, v in a.items() if not k.startswith("_")}
        insert_alert(a_clean)
    return event_id, alerts

def collect_batch(raw_events: list) -> list:
    out = []
    for r in raw_events:
        eid, alerts = collect(r)
        out.append((eid, alerts))
    return out
