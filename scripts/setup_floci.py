"""Create 2-3 buckets, 2-3 IAM users, policies, keys, one insecure + one normal."""
import boto3, json, os
from botocore.config import Config

ENDPOINT = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
cfg = Config(retries={"max_attempts":1}, connect_timeout=2, read_timeout=5)
kw = dict(endpoint_url=ENDPOINT, region_name="us-east-1", aws_access_key_id="test", aws_secret_access_key="test", config=cfg)
s3 = boto3.client("s3", **kw)
iam = boto3.client("iam", **kw)

def ensure_bucket(name, public=False):
    try: s3.create_bucket(Bucket=name)
    except Exception as e: print(f"bucket {name}: {e}")
    if public:
        try: s3.put_bucket_acl(Bucket=name, ACL="public-read")
        except Exception as e: print(f"public acl {name}: {e}")
    try: s3.put_object(Bucket=name, Key="readme.txt", Body=b"normal content")
    except Exception: pass

def ensure_user(name):
    try: iam.create_user(UserName=name)
    except Exception: pass
    try: iam.create_access_key(UserName=name)
    except Exception: pass

def main():
    print(f"Floci endpoint: {ENDPOINT}")
    # buckets
    ensure_bucket("csm-secure-bucket", public=False)
    ensure_bucket("csm-public-bucket", public=True)  # insecure
    ensure_bucket("csm-logs-bucket", public=False)
    print("buckets:", [b["Name"] for b in s3.list_buckets().get("Buckets",[]) if b["Name"].startswith("csm")])

    # users
    for u in ["alice", "bob", "csm-admin"]:
        ensure_user(u)
    # normal policy for alice, admin for csm-admin
    try:
        iam.put_user_policy(UserName="alice", PolicyName="ReadOnly", PolicyDocument=json.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:ListBucket"],"Resource":"*"}]}))
    except Exception as e: print(e)
    try:
        iam.put_user_policy(UserName="csm-admin", PolicyName="AdminAccess", PolicyDocument=json.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}))
    except Exception as e: print(e)
    print("users:", [u["UserName"] for u in iam.list_users().get("Users",[])])

if __name__ == "__main__":
    main()
