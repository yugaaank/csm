import sqlite3
import os
from datetime import datetime, timezone
from .config import DB_PATH

DDL = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user TEXT,
    service TEXT,
    action TEXT,
    resource TEXT,
    source_ip TEXT,
    status TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT,
    risk_score INTEGER,
    mitre_technique TEXT,
    recommendation TEXT,
    created_at TEXT,
    status TEXT DEFAULT 'OPEN'
);
"""

def get_conn():
    path = os.path.abspath(DB_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript(DDL)
    conn.commit()
    conn.close()

def insert_event(evt: dict) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO events (timestamp, user, service, action, resource, source_ip, status) VALUES (?,?,?,?,?,?,?)",
        (evt.get("timestamp") or datetime.now(timezone.utc).isoformat(),
         evt.get("user"), evt.get("service"), evt.get("action"),
         evt.get("resource"), evt.get("source_ip", "127.0.0.1"), evt.get("status", "success"))
    )
    conn.commit()
    eid = cur.lastrowid
    conn.close()
    return eid

def insert_alert(alert: dict) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO alerts (event_id, title, description, severity, risk_score, mitre_technique, recommendation, created_at, status) VALUES (?,?,?,?,?,?,?,?,?)",
        (alert.get("event_id"), alert["title"], alert.get("description"),
         alert.get("severity"), alert.get("risk_score"), alert.get("mitre_technique"),
         alert.get("recommendation"), alert.get("created_at") or datetime.now(timezone.utc).isoformat(),
         alert.get("status", "OPEN"))
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid

def query(sql, args=()):
    conn = get_conn()
    rows = conn.execute(sql, args).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def execute(sql, args=()):
    conn = get_conn()
    conn.execute(sql, args)
    conn.commit()
    conn.close()
