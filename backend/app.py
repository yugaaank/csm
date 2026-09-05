from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os, json
from datetime import datetime, timezone

from .database import init_db, query, execute, get_conn
from .event_collector import collect
from .risk_engine import overall_security_score
from .config import DB_PATH
try:
    from .ml_detector import load as ml_load, get_status as ml_status
    ml_load()
except Exception:
    ml_status = lambda: {"ready": False, "model_exists": False, "model_path": None}  # ponytail: fail-open if ml missing

import os as _os
_frontend_dist = _os.path.join(_os.path.dirname(__file__), "../frontend/dist")
_frontend_src = _os.path.join(_os.path.dirname(__file__), "../frontend")
_static = _frontend_dist if _os.path.exists(_frontend_dist) else _frontend_src
app = Flask(__name__, static_folder=_static, static_url_path="")
CORS(app)
init_db()

# ---- helpers ----
def _filter_sql(base: str, params: dict, allowed: dict):
    """allowed: {query_key: (column, op)}; op '=' or 'like'."""
    sql = base
    args = []
    for k, (col, op) in allowed.items():
        v = params.get(k)
        if v:
            if op == "like":
                sql += f" AND {col} LIKE ?"
                args.append(f"%{v}%")
            else:
                sql += f" AND {col}=?"
                args.append(v)
    return sql, args

# ---- API ----
@app.get("/api/overview")
def overview():
    events = query("SELECT COUNT(*) as c FROM events")[0]["c"]
    alerts = query("SELECT * FROM alerts")
    open_alerts = [a for a in alerts if a["status"] == "OPEN"]
    by_sev = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for a in open_alerts:
        by_sev[a["severity"]] = by_sev.get(a["severity"], 0) + 1
    score = overall_security_score(alerts)
    return jsonify({
        "security_score": score,
        "total_events": events,
        "total_alerts": len(alerts),
        "open_alerts": len(open_alerts),
        "by_severity": by_sev,
    })

@app.get("/api/events")
def list_events():
    # filters: service, user, action, limit
    limit = int(request.args.get("limit", 100))
    limit = max(1, min(limit, 500))
    base = "SELECT * FROM events WHERE 1=1"
    allowed = {"service": ("service", "="), "user": ("user", "="), "action": ("action", "=")}
    sql, args = _filter_sql(base, request.args, allowed)
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    rows = query(sql, args)
    return jsonify(rows)

@app.get("/api/alerts")
def list_alerts():
    base = "SELECT * FROM alerts WHERE 1=1"
    allowed = {"severity": ("severity", "="), "status": ("status", "=")}
    sql, args = _filter_sql(base, request.args, allowed)
    # date filter
    date = request.args.get("date")
    if date:
        sql += " AND date(created_at)=date(?)"
        args.append(date)
    sql += " ORDER BY id DESC"
    rows = query(sql, args)
    return jsonify(rows)

@app.get("/api/alerts/<int:aid>")
def alert_detail(aid):
    rows = query("SELECT * FROM alerts WHERE id=?", (aid,))
    if not rows:
        return jsonify({"error": "not found"}), 404
    alert = rows[0]
    evt = query("SELECT * FROM events WHERE id=?", (alert["event_id"],))
    alert["event"] = evt[0] if evt else None
    return jsonify(alert)

@app.patch("/api/alerts/<int:aid>")
def update_alert(aid):
    data = request.get_json(force=True)
    status = data.get("status")
    if status not in ("OPEN", "REVIEWED", "RESOLVED"):
        return jsonify({"error": "invalid status"}), 400
    execute("UPDATE alerts SET status=? WHERE id=?", (status, aid))
    return jsonify({"ok": True})

@app.post("/api/collect")
def api_collect():
    raw = request.get_json(force=True)
    # accept single or list
    def _clean(alerts):
        return [{k: v for k, v in a.items() if not k.startswith("_")} for a in alerts]
    if isinstance(raw, list):
        out = []
        for r in raw:
            eid, alerts = collect(r)
            out.append({"event_id": eid, "alerts": _clean(alerts)})
        return jsonify(out)
    eid, alerts = collect(raw)
    return jsonify({"event_id": eid, "alerts": _clean(alerts)})
@app.post("/api/simulate")
def simulate():
    """Run demo scenario operations against Floci and collect events."""
    from .floci_client import s3_client, iam_client
    import uuid, time
    s3 = s3_client()
    iam = iam_client()
    results = []
    user = request.get_json(silent=True) or {}
    actor = user.get("user", "demo-user")
    bucket = f"csm-demo-{uuid.uuid4().hex[:6]}"
    # 1 create bucket
    try:
        s3.create_bucket(Bucket=bucket)
        eid, _ = collect({"user": actor, "service": "S3", "action": "CreateBucket", "resource": bucket, "source_ip": "127.0.0.1", "status": "success"})
        results.append(f"CreateBucket {bucket} -> event {eid}")
    except Exception as e:
        results.append(f"CreateBucket failed: {e}")
    # 2 upload
    try:
        s3.put_object(Bucket=bucket, Key="hello.txt", Body=b"hello csm")
        eid, _ = collect({"user": actor, "service": "S3", "action": "PutObject", "resource": f"{bucket}/hello.txt", "source_ip": "127.0.0.1"})
        results.append(f"PutObject -> event {eid}")
    except Exception as e:
        results.append(f"PutObject failed: {e}")
    # 3 get
    try:
        s3.get_object(Bucket=bucket, Key="hello.txt")
        eid, _ = collect({"user": actor, "service": "S3", "action": "GetObject", "resource": f"{bucket}/hello.txt"})
        results.append(f"GetObject -> event {eid}")
    except Exception as e:
        results.append(f"GetObject failed: {e}")
    # 4 make public (triggers rule 1)
    try:
        s3.put_bucket_acl(Bucket=bucket, ACL="public-read")
        eid, alerts = collect({"user": actor, "service": "S3", "action": "PutBucketAcl", "resource": bucket})
        results.append(f"PutBucketAcl public-read -> event {eid} alerts {len(alerts)}")
    except Exception as e:
        results.append(f"PutBucketAcl failed: {e}")
    # 5 create access key (rule 3) — ensure user exists
    iam_user = f"csm-user-{uuid.uuid4().hex[:4]}"
    try:
        iam.create_user(UserName=iam_user)
    except Exception:
        pass
    try:
        iam.create_access_key(UserName=iam_user)
        eid, alerts = collect({"user": iam_user, "service": "IAM", "action": "CreateAccessKey", "resource": iam_user})
        results.append(f"CreateAccessKey {iam_user} -> event {eid}")
    except Exception as e:
        results.append(f"CreateAccessKey failed: {e}")
    # 6 policy change (rule 2)
    try:
        iam.put_user_policy(UserName=iam_user, PolicyName="AdminAccess", PolicyDocument=json.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}))
        eid, alerts = collect({"user": iam_user, "service": "IAM", "action": "PutUserPolicy", "resource": "AdministratorAccess"})
        results.append(f"PutUserPolicy admin -> event {eid}")
    except Exception as e:
        results.append(f"PutUserPolicy failed: {e}")
    # 7 delete object (rule 4)
    try:
        s3.delete_object(Bucket=bucket, Key="hello.txt")
        eid, _ = collect({"user": actor, "service": "S3", "action": "DeleteObject", "resource": f"{bucket}/hello.txt"})
        results.append(f"DeleteObject -> event {eid}")
    except Exception as e:
        results.append(f"DeleteObject failed: {e}")
    # 8 excessive API (rule 5) – burst 25 GetObject
    for i in range(25):
        eid, _ = collect({"user": actor, "service": "S3", "action": "GetObject", "resource": f"{bucket}/hello.txt"})
    results.append("Burst 25 GetObject -> excessive check")
    return jsonify({"results": results})

@app.get("/api/timeline")
def timeline():
    rows = query("SELECT timestamp, user, service, action, resource FROM events ORDER BY id DESC LIMIT 50")
    return jsonify(list(reversed(rows)))

@app.get("/api/ml/status")
def ml_status_route():
    try:
        return jsonify(ml_status())
    except Exception as e:
        return jsonify({"ready": False, "error": str(e)})

@app.post("/api/ml/train")
def ml_train():
    """Retrain model from current DB. Body: {contamination: 0.05}."""
    try:
        import subprocess, sys as _sys
        contam = (request.get_json(silent=True) or {}).get("contamination", 0.05)
        result = subprocess.run(
            [_sys.executable, "scripts/train.py", "--contamination", str(contam)],
            capture_output=True, text=True, timeout=30, cwd=os.path.join(os.path.dirname(__file__), "..")
        )
        # reload model
        try:
            ml_load()
        except Exception:
            pass
        return jsonify({"ok": result.returncode == 0, "stdout": result.stdout, "stderr": result.stderr, "status": ml_status()})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ---- frontend ----
@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.get("/<path:path>")
def static_files(path):
    full = os.path.join(app.static_folder, path)
    if os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
