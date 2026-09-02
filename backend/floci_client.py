import boto3
from botocore.config import Config
from .config import FLOCI_ENDPOINT, AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_KEY

_boto_cfg = Config(retries={"max_attempts": 1}, connect_timeout=2, read_timeout=5)

def _client(service: str):
    return boto3.client(
        service,
        endpoint_url=FLOCI_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        config=_boto_cfg,
    )

def s3_client():
    return _client("s3")

def iam_client():
    return _client("iam")

# helpers used by detector
def get_bucket_acl(bucket: str) -> dict | None:
    try:
        return s3_client().get_bucket_acl(Bucket=bucket)
    except Exception:
        return None

def get_bucket_policy_status(bucket: str) -> bool | None:
    """True if bucket appears public via policy/acl. None if unknown."""
    try:
        pol = s3_client().get_bucket_policy(Bucket=bucket)
        if '"Principal":"*"' in pol.get("Policy", "") or '"Principal": "*"' in pol.get("Policy", ""):
            return True
    except Exception:
        pass
    try:
        acl = get_bucket_acl(bucket)
        if acl:
            for g in acl.get("Grants", []):
                uri = g.get("Grantee", {}).get("URI", "")
                if "AllUsers" in uri or "AuthenticatedUsers" in uri:
                    return True
            return False
    except Exception:
        pass
    return None

def is_public_bucket_via_floci(bucket: str) -> bool:
    r = get_bucket_policy_status(bucket)
    return bool(r)

def list_buckets():
    try:
        return [b["Name"] for b in s3_client().list_buckets().get("Buckets", [])]
    except Exception:
        return []

def list_users():
    try:
        return [u["UserName"] for u in iam_client().list_users().get("Users", [])]
    except Exception:
        return []
