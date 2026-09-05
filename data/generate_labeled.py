#!/usr/bin/env python3
"""
Generate labeled dataset: 400 benign + 100 attacks, with ground truth.

Benign: Describe/List/Get during business hours, same IP, low burst, diverse services like real CloudTrail.
Attacks: 5 types mapped to our 5 rules + ML anomalies (exfil, priv esc, etc.)

Output: data/labeled.json -> [{"event": {...}, "label": 0/1, "attack_type": str|None}, ...]
Labels are ground truth, not detector output. Use scripts/evaluate.py to compare.

This breaks the "train on own fake attacks" circle — evaluate on held-out labeled set.
Also serves as importable CloudTrail-like dataset.
"""
import json, os, random
from datetime import datetime, timezone, timedelta

random.seed(42)

OUT = os.path.join(os.path.dirname(__file__), "labeled.json")

BENIGN_USERS = ["alice", "bob", "carol", "dave", "eve"]
BENIGN_ACTIONS = [
    ("S3", "ListBuckets"), ("S3", "ListObjects"), ("S3", "GetObject"), ("S3", "HeadObject"),
    ("S3", "GetBucketLocation"), ("S3", "ListObjectVersions"),
    ("IAM", "ListUsers"), ("IAM", "GetUser"), ("IAM", "ListRoles"), ("IAM", "GetCallerIdentity"),
    ("EC2", "DescribeInstances"), ("EC2", "DescribeSecurityGroups"), ("EC2", "DescribeVolumes"),
    ("STS", "GetCallerIdentity"), ("STS", "AssumeRole"),
]
BENIGN_IPS = {"alice": "10.0.1.10", "bob": "10.0.1.11", "carol": "10.0.1.12", "dave": "10.0.1.13", "eve": "10.0.1.14"}

ATTACK_TEMPLATES = [
    # type, user, service, action, resource, ip, label reason
    ("public_s3", "mallory", "S3", "PutBucketAcl", "exfil-bucket", "203.0.113.99"),
    ("iam_policy_change", "mallory", "IAM", "PutUserPolicy", "AdministratorAccess", "203.0.113.99"),
    ("new_access_key", "mallory", "IAM", "CreateAccessKey", "mallory", "203.0.113.99"),
    ("s3_deletion", "mallory", "S3", "DeleteObject", "exfil-bucket/secrets.csv", "203.0.113.99"),
    ("excessive_api", "mallory", "S3", "GetObject", "exfil-bucket/data", "203.0.113.99"),  # burst
    ("off_hours_ip", "bob", "S3", "GetObject", "csm-secure-bucket/secret", "198.51.100.77"),  # ML-only: off-hours + new IP
]

def _ts(hour):
    base = datetime(2026, 9, 5, hour, random.randint(0,59), random.randint(0,59), tzinfo=timezone.utc)
    return base.isoformat()

def gen_benign(n=400):
    out=[]
    for _ in range(n):
        user = random.choice(BENIGN_USERS)
        svc, act = random.choice(BENIGN_ACTIONS)
        hour = random.randint(9,17)  # business hours 90% + 10% edge
        if random.random() < 0.08:
            hour = random.randint(0,23)
        ip = BENIGN_IPS[user] if random.random()<0.93 else BENIGN_IPS[user][:-1]+str(random.randint(5,9))
        out.append({
            "event": {
                "timestamp": _ts(hour),
                "user": user,
                "service": svc,
                "action": act,
                "resource": f"csm-bucket-{random.randint(1,5)}/file{random.randint(1,100)}.txt" if svc=="S3" else f"user/{user}",
                "source_ip": ip,
                "status": "success"
            },
            "label": 0,
            "attack_type": None
        })
    return out

def gen_attacks(n=100):
    out=[]
    # mix: 20% each type + 20% off-hours ml-only
    for i in range(n):
        # burst excessive_api: 25 events count as 1 attack window, but we emit single events flagged as attack
        tmpl = random.choice(ATTACK_TEMPLATES)
        atype, user, svc, act, res, ip = tmpl
        # 70% off-hours for attacks to test ML
        hour = random.choice([2,3,4,22,23]) if random.random()<0.7 else random.randint(9,17)
        out.append({
            "event": {
                "timestamp": _ts(hour),
                "user": user,
                "service": svc,
                "action": act,
                "resource": res,
                "source_ip": ip,
                "status": "success"
            },
            "label": 1,
            "attack_type": atype
        })
    # add burst sequences: 5 bursts of 25 GetObject as separate events labeled 1 (excessive_api)
    # expand one burst into multiple events for evaluate windowing
    burst_events=[]
    for b in range(3):
        base_hour = 3
        base_ts = datetime(2026,9,5,base_hour,0,0, tzinfo=timezone.utc)
        for k in range(25):
            ts = (base_ts + timedelta(seconds=k*2)).isoformat()
            burst_events.append({
                "event": {"timestamp": ts, "user": "mallory", "service":"S3","action":"GetObject","resource":"exfil-bucket/data","source_ip":"203.0.113.99","status":"success"},
                "label": 1, "attack_type":"excessive_api"
            })
    out.extend(burst_events)
    random.shuffle(out)
    return out[:n]

def main():
    benign = gen_benign(400)
    attacks = gen_attacks(100)
    data = benign + attacks
    random.shuffle(data)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT,"w") as f:
        json.dump(data, f, indent=2)
    # quick stats
    n_benign = sum(1 for d in data if d["label"]==0)
    n_attack = sum(1 for d in data if d["label"]==1)
    print(f"Wrote {len(data)} events -> {OUT}")
    print(f" benign {n_benign} / attack {n_attack}")
    # also write real CloudTrail-like version (eventName/eventSource)
    ct = []
    for d in data:
        e = d["event"]
        ct.append({
            "eventTime": e["timestamp"],
            "eventName": e["action"],
            "eventSource": e["service"].lower()+".amazonaws.com" if e["service"]!="UNKNOWN" else "unknown.amazonaws.com",
            "userIdentity": {"userName": e["user"]},
            "sourceIPAddress": e["source_ip"],
            "requestParameters": {"bucketName": e["resource"]},
            "label": d["label"],
            "attack_type": d["attack_type"]
        })
    with open(os.path.join(os.path.dirname(__file__), "sample_cloudtrail.json"),"w") as f:
        json.dump(ct[:20], f, indent=2)
    print("Also wrote sample_cloudtrail.json (20 CloudTrail format)")

if __name__=="__main__":
    main()
