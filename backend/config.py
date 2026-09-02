import os

FLOCI_ENDPOINT = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
# floci env uses http://localhost.floci.io:4566 – both resolve to same
if "floci.io" not in FLOCI_ENDPOINT and os.getenv("FLOCI_ENDPOINT"):
    FLOCI_ENDPOINT = os.getenv("FLOCI_ENDPOINT")

AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "test")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")

DB_PATH = os.getenv("CSM_DB", os.path.join(os.path.dirname(__file__), "..", "csm.db"))

# detection thresholds
EXCESSIVE_API_THRESHOLD = int(os.getenv("CSM_EXCESSIVE_THRESHOLD", "20"))
EXCESSIVE_API_WINDOW_SEC = int(os.getenv("CSM_EXCESSIVE_WINDOW", "60"))

# risk scores per finding
RISK_SCORES = {
    "public_s3_bucket": 85,
    "iam_policy_change": 90,
    "new_access_key": 55,
    "s3_deletion": 50,
    "excessive_api": 80,
}

def risk_level(score: int) -> str:
    if score >= 90:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"
