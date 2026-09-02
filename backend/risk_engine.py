from .config import RISK_SCORES, risk_level

def score_for(rule_id: str) -> int:
    return RISK_SCORES.get(rule_id, 50)

def level_for(score: int) -> str:
    return risk_level(score)
def overall_security_score(alerts: list) -> int:
    if not alerts:
        return 100
    total = sum(a.get("risk_score", 0) for a in alerts if a.get("status") == "OPEN")
    score = max(0, 100 - int(total / 5))
    return score
