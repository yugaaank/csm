"""Demo scenario: performs cloud ops via Floci and posts events to the monitor via HTTP or direct collect."""
import os, sys, uuid, time, json, requests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend.event_collector import collect

BASE = os.getenv("CSM_BASE", "http://localhost:5000")

def via_api(raw):
    try:
        r = requests.post(f"{BASE}/api/collect", json=raw, timeout=3)
        print(f"API collect {raw['action']} -> {r.status_code}")
        return
    except Exception as e:
        print(f"API unavailable ({e}), using direct collect")
        eid, alerts = collect(raw)
        print(f"  direct event {eid} alerts {len(alerts)}")

def run():
    # Use API simulate if available (does floci ops + collects)
    try:
        r = requests.post(f"{BASE}/api/simulate", json={"user": "alice"}, timeout=10)
        print("simulate:", r.json())
        return
    except Exception as e:
        print(f"simulate via API failed: {e}, running local ops")

    import boto3
    from botocore.config import Config
    ENDPOINT = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    kw = dict(endpoint_url=ENDPOINT, region_name="us-east-1", aws_access_key_id="test", aws_secret_access_key="test", config=Config(retries={"max_attempts":1}))
    s3 = boto3.client("s3", **kw)
    iam = boto3.client("iam", **kw)
    bucket = f"csm-demo-{uuid.uuid4().hex[:6]}"
    s3.create_bucket(Bucket=bucket)
    via_api({"user":"alice","service":"S3","action":"CreateBucket","resource":bucket})
    s3.put_object(Bucket=bucket, Key="secret.txt", Body=b"demo")
    via_api({"user":"alice","service":"S3","action":"PutObject","resource":f"{bucket}/secret.txt"})
    s3.get_object(Bucket=bucket, Key="secret.txt")
    via_api({"user":"alice","service":"S3","action":"GetObject","resource":f"{bucket}/secret.txt"})
    try: s3.put_bucket_acl(Bucket=bucket, ACL="public-read")
    except: pass
    via_api({"user":"alice","service":"S3","action":"PutBucketAcl","resource":bucket})
    uname = f"demo-{uuid.uuid4().hex[:4]}"
    try: iam.create_user(UserName=uname)
    except: pass
    try: iam.create_access_key(UserName=uname)
    except: pass
    via_api({"user":uname,"service":"IAM","action":"CreateAccessKey","resource":uname})
    try: iam.put_user_policy(UserName=uname, PolicyName="AdminAccess", PolicyDocument=json.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}))
    except: pass
    via_api({"user":uname,"service":"IAM","action":"PutUserPolicy","resource":"AdministratorAccess"})
    s3.delete_object(Bucket=bucket, Key="secret.txt")
    via_api({"user":"alice","service":"S3","action":"DeleteObject","resource":f"{bucket}/secret.txt"})
    for i in range(25):
        via_api({"user":"alice","service":"S3","action":"GetObject","resource":f"{bucket}/secret.txt"})
    print("demo complete — check dashboard at", BASE)

if __name__ == "__main__":
    run()
