#!/usr/bin/env python3
"""Train IsolationForest on historical events from SQLite.

Usage:
  uv run python scripts/train.py              # train from csm.db
  uv run python scripts/train.py --synthetic  # train on synthetic normal data (no DB needed)
  uv run python scripts/train.py --db path/to.db --contamination 0.05

Produces ml/model.pkl. Safe to re-run — overwrites.
If <20 events in DB, augments with synthetic normal events so training works on fresh DB.
"""
import argparse
import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

def _synthetic_normal(n=200):
    """Generate plausible normal traffic for fallback."""
    rng = np.random.default_rng(42)
    # mix of single and burst: count_60s 1-6, hour 9-17 (90%) + 0-23 (10%), diversity 0.2-1.0
    counts = rng.poisson(3, n).clip(1, 8).astype(float)
    # 10% off-hours synthetic normals so 03:00 alone isn't anomalous
    hours_raw = rng.integers(9, 18, n)
    off_idx = rng.choice(n, size=n // 10, replace=False)
    hours_raw[off_idx] = rng.integers(0, 24, len(off_idx))
    hours = hours_raw / 23.0
    off = np.array([1.0 if h in (0, 1, 2, 3, 4, 5, 22, 23) else 0.0 for h in hours_raw], dtype=float)
    ip = rng.choice([0.0, 1.0], n, p=[0.95, 0.05])
    div = rng.uniform(0.2, 1.0, n)  # single-event window => 1.0 must be normal
    return np.column_stack([counts, hours, off, ip, div])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=None, help="path to csm.db")
    parser.add_argument("--contamination", type=float, default=0.05)
    parser.add_argument("--synthetic", action="store_true", help="train only on synthetic data")
    parser.add_argument("--labeled", default=None, help="path to data/labeled.json — trains on benign (label 0) only, best for evaluation")
    args = parser.parse_args()

    # build X
    X = None

    if args.labeled:
        try:
            import json
            from backend.ml_features import featurize
            data = json.load(open(args.labeled))
            benign = [d["event"] for d in data if d.get("label")==0]
            benign_sorted = sorted(benign, key=lambda x: x.get("timestamp",""))
            feats=[]
            recent=[]
            for evt in benign_sorted:
                recent_window = recent[-99:]+[evt] if recent else [evt]
                feats.append(featurize(evt, recent_window))
                recent.append(evt)
            X = np.array(feats, dtype=float)
            print(f"Built {len(feats)} benign vectors from {args.labeled}")
        except Exception as e:
            print(f"Labeled load failed ({e}), falling back")
            X=None
    if X is None and not args.synthetic:
        try:
            from backend.database import query
            from backend.ml_features import featurize
            from backend.config import DB_PATH

            db_path = args.db or DB_PATH
            # ensure import sees correct DB
            os.environ["CSM_DB"] = os.path.abspath(db_path)

            # exclude events marked as false positive feedback — feedback loop
            try:
                fps = query("SELECT event_id FROM feedback WHERE is_false_positive=1")
                fp_ids = {r["event_id"] for r in fps}
                if fp_ids:
                    print(f"Excluding {len(fp_ids)} false-positive events from training")
            except Exception:
                fp_ids = set()

            rows = query("SELECT * FROM events ORDER BY id ASC LIMIT 500")
            if rows:
                # filter out FP events
                rows_filtered = [r for r in rows if r["id"] not in fp_ids]
                if len(rows_filtered) < len(rows):
                    print(f"Filtered {len(rows)-len(rows_filtered)} FP events, {len(rows_filtered)} remain")
                rows = rows_filtered
                feats = []
                # for each row, use up to 100 prior rows as recent context
                for idx, row in enumerate(rows):
                    evt = {
                        "user": row["user"],
                        "timestamp": row["timestamp"],
                        "service": row["service"],
                        "action": row["action"],
                        "resource": row["resource"],
                        "source_ip": row["source_ip"],
                    }
                    recent = rows[max(0, idx - 100) : idx + 1]
                    # recent includes current — matches event_collector behavior
                    feats.append(featurize(evt, recent))
                X = np.array(feats, dtype=float)
                print(f"Built {len(feats)} feature vectors from DB {db_path}")
            else:
                print("No events in DB, will use synthetic data")
        except Exception as e:
            print(f"DB featurization failed ({e}), falling back to synthetic")
            X = None
    if X is None or len(X) < 20:
        syn = _synthetic_normal(200)
        if X is not None and len(X) > 0:
            X = np.vstack([X, syn])
            print(f"Augmented with {len(syn)} synthetic rows -> total {len(X)}")
        else:
            X = syn
            print(f"Using {len(X)} synthetic rows")

    # train
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        print("scikit-learn not installed. Run: uv pip install -r requirements.txt")
        sys.exit(1)

    import joblib

    model = IsolationForest(
        contamination=args.contamination,
        random_state=42,
        n_estimators=100,
    )
    model.fit(X)

    out_path = os.path.join(os.path.dirname(__file__), "..", "ml", "model.pkl")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    joblib.dump(model, out_path)
    print(f"Saved model to {os.path.abspath(out_path)}")
    # quick sanity: score distribution
    scores = model.decision_function(X)
    print(f"Train scores: min {scores.min():.3f} max {scores.max():.3f} mean {scores.mean():.3f}")
    preds = model.predict(X)
    n_anom = (preds == -1).sum()
    print(f"Anomalies in train set: {n_anom}/{len(X)} ({n_anom/len(X):.1%}, target {args.contamination:.0%})")


if __name__ == "__main__":
    main()
