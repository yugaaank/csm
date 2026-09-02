from datetime import datetime, timezone, timedelta
from .config import EXCESSIVE_API_THRESHOLD, EXCESSIVE_API_WINDOW_SEC
from .risk_engine import score_for
from .mitre import technique, recommendation
from . import floci_client

# Rule ids
RULES = {
    "public_s3_bucket": {"title": "Public S3 Bucket Detected", "severity": "HIGH",
                         "desc": "Public S3 bucket detected. The bucket may expose stored data to unauthorized users."},
    "iam_policy_change": {"title": "IAM Policy Changed", "severity": "HIGH",
                          "desc": "Administrator-level permissions were added to the IAM user."},
    "new_access_key": {"title": "New Access Key Created", "severity": "MEDIUM",
                       "desc": "A new IAM access key was created."},
    "s3_deletion": {"title": "S3 Object Deleted", "severity": "MEDIUM",
                    "desc": "An S3 object was unexpectedly deleted."},
    "excessive_api": {"title": "Excessive API Activity", "severity": "HIGH",
                      "desc": "Unusually high number of API requests detected within a short time window."},
}

def _alert(rule_id: str, event_id: int, extra_desc: str = ""):
    r = RULES[rule_id]
    desc = r["desc"] + (f" {extra_desc}" if extra_desc else "")
    return {
        "event_id": event_id,
        "title": r["title"],
        "description": desc.strip(),
        "severity": r["severity"],
        "risk_score": score_for(rule_id),
        "mitre_technique": technique(rule_id),
        "recommendation": recommendation(rule_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "OPEN",
        "_rule": rule_id,
    }

def detect(event: dict, event_id: int, recent_events: list) -> list:
    """Run all 5 rules against a single normalized event. Returns list of alert dicts."""
    alerts = []
    action = (event.get("action") or "").strip()
    service = (event.get("service") or "").upper()
    resource = event.get("resource") or ""
    user = event.get("user") or "unknown"

    # Rule 3: New Access Key
    if action in ("CreateAccessKey", "CreateAccessKeyPair"):
        alerts.append(_alert("new_access_key", event_id, f"User {user} at {event.get('timestamp')}."))

    # Rule 4: S3 Object Deletion
    if service == "S3" and action in ("DeleteObject", "DeleteObjects", "DeleteObjectTagging"):
        alerts.append(_alert("s3_deletion", event_id, f"Bucket/object: {resource} by {user}."))

    # Rule 2: IAM Policy Change
    if service == "IAM" and action in ("PutUserPolicy", "AttachUserPolicy", "PutRolePolicy", "AttachRolePolicy", "PutGroupPolicy", "CreatePolicy", "AttachGroupPolicy"):
        # consider excessive perms heuristic: presence of * or Administrator
        extra = resource.lower()
        is_admin = "admin" in extra or "*" in extra or "administrator" in extra
        desc_extra = f"Resource/policy: {resource}." + (" Administrator privileges detected." if is_admin else "")
        alerts.append(_alert("iam_policy_change", event_id, desc_extra))

    # Rule 1: Public S3 Bucket
    # Trigger on bucket-related actions; verify via Floci if possible
    if service == "S3" and action in ("CreateBucket", "PutBucketPolicy", "PutBucketAcl", "PutObjectAcl", "CreateBucketPolicy"):
        bucket = resource.split("/")[0] if resource else ""
        if bucket:
            is_public = floci_client.is_public_bucket_via_floci(bucket)
            if is_public or action in ("PutBucketAcl", "PutBucketPolicy"):
                alerts.append(_alert("public_s3_bucket", event_id, f"Bucket: {bucket}. Review Block Public Access."))

    # Rule 5: Excessive API Activity — > threshold ops in window per user
    # recent_events includes current event; filter by user and time window
    try:
        now = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")) if "timestamp" in event else datetime.now(timezone.utc)
    except Exception:
        now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=EXCESSIVE_API_WINDOW_SEC)
    count = 0
    for e in recent_events:
        try:
            ts = datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
        except Exception:
            continue
        if e.get("user") == user and window_start <= ts <= now:
            count += 1
    if count > EXCESSIVE_API_THRESHOLD:
        # de-duplicate: only fire once per window - check if already alerted for this user window
        # simple: fire if count == threshold+1 (first breach)
        if count == EXCESSIVE_API_THRESHOLD + 1:
            alerts.append(_alert("excessive_api", event_id, f"{count} API operations by {user} in {EXCESSIVE_API_WINDOW_SEC}s (threshold {EXCESSIVE_API_THRESHOLD})."))
    return alerts
