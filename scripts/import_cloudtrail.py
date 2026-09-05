#!/usr/bin/env python3
"""
Import real CloudTrail JSON (aws cloudtrail lookup-events or data/sample_cloudtrail.json)
and feed through event_collector.

Usage:
  uv run python scripts/import_cloudtrail.py data/sample_cloudtrail.json
  uv run python scripts/import_cloudtrail.py /path/to/cloudtrail_dump.json --limit 100

Real CloudTrail fields mapped to our normalized event via event_collector.normalize_event:
  eventTime -> timestamp, userIdentity.userName -> user, eventSource -> service,
  eventName -> action, requestParameters.bucketName -> resource, sourceIPAddress -> source_ip

Preserves original label/attack_type if present (for evaluation), but not stored in DB.
"""
import json, os, sys, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend.event_collector import collect

def parse_cloudtrail_record(r: dict) -> dict:
    # handle both our labeled.json format and real CloudTrail
    if "event" in r:  # labeled.json
        return r["event"]
    # real CloudTrail
    return {
        "timestamp": r.get("eventTime") or r.get("timestamp"),
        "user": (r.get("userIdentity") or {}).get("userName") or r.get("user") or "unknown",
        "service": (r.get("eventSource") or "").split(".")[0].upper() or r.get("service") or "UNKNOWN",
        "action": r.get("eventName") or r.get("action"),
        "resource": (r.get("requestParameters") or {}).get("bucketName") or r.get("resource") or "",
        "source_ip": r.get("sourceIPAddress") or r.get("source_ip") or "127.0.0.1",
        "status": "success" if not r.get("errorCode") else "failure",
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="JSON file (array or single object or JSONL)")
    ap.add_argument("--limit", type=int, default=0, help="max events to import (0=all)")
    ap.add_argument("--dry", action="store_true", help="parse only, don't insert")
    args = ap.parse_args()
    data = json.load(open(args.path))
    if isinstance(data, dict):
        data = [data]
    # handle JSONL fallback already list
    if args.limit:
        data = data[:args.limit]
    print(f"Importing {len(data)} records from {args.path}")
    n_events=n_alerts=0
    for raw in data:
        evt = parse_cloudtrail_record(raw)
        if args.dry:
            print(evt)
        else:
            eid, alerts = collect(evt)
            n_events+=1
            n_alerts+=len(alerts)
            if alerts:
                print(f" event {eid} -> {[a['title'] for a in alerts]}")
    print(f"Done: {n_events} events, {n_alerts} alerts")

if __name__=="__main__":
    main()
