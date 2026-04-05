from app.schemas.models import TransactionItem
from typing import List


def predict_expenses(balance: float, transactions: List[TransactionItem]) -> dict:
    debits = [t for t in transactions if t.type == "debit"]

    if not debits:
        return {
            "predicted_weekly_expense": 0,
            "days_until_low_balance": 999,
            "warning": "Not enough transaction data to make predictions.",
            "avg_daily_spending": 0,
            "current_balance": balance,
        }

    total_spent = sum(t.amount for t in debits)
    avg_per_txn = total_spent / len(debits)

    # Estimate daily spending (assume ~1-2 transactions per day)
    avg_daily = avg_per_txn * 1.5
    predicted_weekly = avg_daily * 7

    # Days until balance is critically low (< ₹1000)
    days_until_low = int((balance - 1000) / avg_daily) if avg_daily > 0 else 999
    days_until_low = max(0, days_until_low)

    if days_until_low < 7:
        warning = f"⚠️ Critical: You may run out of funds within {days_until_low} days!"
    elif days_until_low < 14:
        warning = f"Warning: Your balance may become low in about {days_until_low} days. Consider reducing spending."
    elif days_until_low < 30:
        warning = f"Your balance should last about {days_until_low} days at current spending rate."
    else:
        warning = "Your balance looks healthy for the coming weeks."

    return {
        "predicted_weekly_expense": round(predicted_weekly),
        "days_until_low_balance": days_until_low,
        "warning": warning,
        "avg_daily_spending": round(avg_daily),
        "current_balance": balance,
    }
