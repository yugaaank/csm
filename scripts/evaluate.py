#!/usr/bin/env python3
"""
Evaluate detector + ML vs ground truth labels.

Usage:
  uv run python scripts/evaluate.py                 # uses data/labeled.json
  uv run python scripts/evaluate.py --path data/labeled.json --save ml/metrics.json
  uv run python scripts/evaluate.py --db csm.db    # evaluate on DB events with known labels (needs labeled import)

Compares:
 - Rules only (detector.detect)
 - ML only (ml_detector.ml_detect)
 - Combined (rules OR ml)

Outputs: confusion matrix, precision/recall/F1 per method.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone
from backend.detector import detect
from backend.ml_detector import load as ml_load, ml_detect
from backend.ml_features import featurize
from backend.database import query

def _metrics(y_true, y_pred):
    tp = sum(1 for t,p in zip(y_true,y_pred) if t==1 and p==1)
    tn = sum(1 for t,p in zip(y_true,y_pred) if t==0 and p==0)
    fp = sum(1 for t,p in zip(y_true,y_pred) if t==0 and p==1)
    fn = sum(1 for t,p in zip(y_true,y_pred) if t==1 and p==0)
    precision = tp/(tp+fp) if (tp+fp) else 0
    recall = tp/(tp+fn) if (tp+fn) else 0
    f1 = 2*precision*recall/(precision+recall) if (precision+recall) else 0
    acc = (tp+tn)/len(y_true) if y_true else 0
    return {"tp":tp,"tn":tn,"fp":fp,"fn":fn,"precision":precision,"recall":recall,"f1":f1,"accuracy":acc}

def evaluate_labeled(path):
    data = json.load(open(path))
    # ensure chronological for windowed features
    data_sorted = sorted(data, key=lambda x: x["event"].get("timestamp",""))
    ml_load()
    y_true=[]
    y_rules=[]
    y_ml=[]
    y_comb=[]
    # build recent window as we iterate
    recent=[]
    for item in data_sorted:
        evt = item["event"]
        label = item["label"]
        # recent for this event: last 100 prior + current (to match collector)
        recent_window = recent[-99:] + [evt] if len(recent)>=1 else [evt]
        # need event_id dummy
        rule_alerts = detect(evt, 9999, recent_window)
        ml_alerts = ml_detect(evt, 9999, recent_window)
        pred_rules = 1 if rule_alerts else 0
        pred_ml = 1 if ml_alerts else 0
        pred_comb = 1 if (rule_alerts or ml_alerts) else 0
        y_true.append(label)
        y_rules.append(pred_rules)
        y_ml.append(pred_ml)
        y_comb.append(pred_comb)
        recent.append(evt)

    m_rules = _metrics(y_true, y_rules)
    m_ml = _metrics(y_true, y_ml)
    m_comb = _metrics(y_true, y_comb)
    return {"rules":m_rules, "ml":m_ml, "combined":m_comb, "n":len(y_true), "n_attack":sum(y_true)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", default="data/labeled.json", help="labeled JSON path")
    ap.add_argument("--save", default="ml/metrics.json", help="where to save metrics JSON (empty to skip)")
    args = ap.parse_args()
    if not os.path.exists(args.path):
        print(f"Missing {args.path}. Run: uv run python data/generate_labeled.py")
        sys.exit(1)
    print(f"Evaluating on {args.path} ...")
    res = evaluate_labeled(args.path)
    print(f"\nDataset: {res['n']} events, {res['n_attack']} attacks / {res['n']-res['n_attack']} benign")
    print("\nMethod   Prec   Recall  F1     Acc    TP  FP  FN  TN")
    print("-"*58)
    for k in ["rules","ml","combined"]:
        m=res[k]
        print(f"{k:8} {m['precision']:4.2f}   {m['recall']:4.2f}   {m['f1']:4.2f}  {m['accuracy']:4.2f}   {m['tp']:3} {m['fp']:3} {m['fn']:3} {m['tn']:3}")
    # also print current model status
    try:
        from backend.ml_detector import get_status
        print("\nModel:", get_status())
    except: pass
    # highlight improvement
    print(f"\nCombined vs Rules: +{res['combined']['recall']-res['rules']['recall']:.2f} recall, {res['combined']['precision']-res['rules']['precision']:+.2f} precision")
    if args.save:
        os.makedirs(os.path.dirname(args.save), exist_ok=True)
        with open(args.save,"w") as f:
            json.dump(res, f, indent=2)
        print(f"Saved -> {os.path.abspath(args.save)}")

if __name__=="__main__":
    main()
