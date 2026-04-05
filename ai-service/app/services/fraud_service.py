from app.schemas.models import TransactionItem
from typing import List
from datetime import datetime, timedelta


def check_fraud(amount: float, balance: float, recent_transactions: List[TransactionItem]) -> dict:
    risk_score = 0.0
    reasons = []

    # Check 1: Amount is more than 80% of balance
    if balance > 0 and amount > balance * 0.8:
        risk_score += 30
        reasons.append("Transaction amount is unusually high relative to balance")

    # Check 2: Amount is much higher than average
    if recent_transactions:
        avg_amount = sum(t.amount for t in recent_transactions) / len(recent_transactions)
        if amount > avg_amount * 5:
            risk_score += 25
            reasons.append(f"Amount is {amount/avg_amount:.1f}x higher than your average transaction")

    # Check 3: Rapid successive transactions
    if len(recent_transactions) >= 3:
        recent_times = []
        for t in recent_transactions[:5]:
            if t.createdAt:
                try:
                    dt = datetime.fromisoformat(t.createdAt.replace("Z", "+00:00"))
                    recent_times.append(dt)
                except (ValueError, AttributeError):
                    pass
        if len(recent_times) >= 3:
            recent_times.sort(reverse=True)
            time_diff = (recent_times[0] - recent_times[2]).total_seconds()
            if time_diff < 300:  # 3 transactions in 5 minutes
                risk_score += 25
                reasons.append("Multiple rapid transactions detected")

    # Check 4: Very large absolute amount
    if amount > 50000:
        risk_score += 15
        reasons.append("Large transaction amount (>₹50,000)")
    elif amount > 100000:
        risk_score += 20
        reasons.append("Very large transaction amount (>₹1,00,000)")

    # Check 5: Transaction would drain account
    if balance > 0 and (balance - amount) < 500:
        risk_score += 10
        reasons.append("Transaction would nearly drain the account")

    risk_score = min(risk_score, 100)
    is_fraud = risk_score >= 60
    reason = "; ".join(reasons) if reasons else "Transaction appears normal"

    return {
        "is_fraud": is_fraud,
        "risk_score": risk_score,
        "reason": reason,
    }
