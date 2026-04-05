from app.schemas.models import TransactionItem
from typing import List


def calculate_loan_score(amount: float, balance: float, transactions: List[TransactionItem]) -> dict:
    score = 50

    # Factor 1: Balance to loan ratio
    ratio = balance / amount if amount > 0 else 0
    if ratio >= 1:
        score += 20
    elif ratio >= 0.5:
        score += 10
    elif ratio < 0.2:
        score -= 10

    # Factor 2: Transaction history
    if len(transactions) >= 20:
        score += 15
    elif len(transactions) >= 10:
        score += 10
    elif len(transactions) >= 5:
        score += 5

    # Factor 3: Income vs spending
    credits = sum(t.amount for t in transactions if t.type == "credit")
    debits = sum(t.amount for t in transactions if t.type == "debit")
    if credits > debits:
        score += 10
    elif credits > 0:
        score += 5

    # Factor 4: Failed transactions (negative signal)
    failed = sum(1 for t in transactions if t.status == "failed" or t.status == "blocked")
    score -= failed * 5

    # Factor 5: Diverse spending (sign of active finances)
    categories = set(t.category for t in transactions if t.category)
    if len(categories) >= 3:
        score += 5

    score = max(0, min(100, score))

    if score >= 60:
        status = "approved"
        interest_rate = max(7.0, 15.0 - (score - 60) * 0.15)
        reason = "Good financial standing. Loan approved based on your spending patterns and balance."
    elif score >= 40:
        status = "review"
        interest_rate = 12.0
        reason = "Your profile needs manual review. Consider maintaining a higher balance."
    else:
        status = "rejected"
        interest_rate = 15.0
        reason = "Insufficient financial history or low balance relative to loan amount."

    return {
        "score": score,
        "status": status,
        "interest_rate": round(interest_rate, 1),
        "reason": reason,
    }
