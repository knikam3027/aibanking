from app.schemas.models import TransactionItem
from typing import List


def generate_insights(balance: float, transactions: List[TransactionItem]) -> dict:
    debits = [t for t in transactions if t.type == "debit"]
    credits = [t for t in transactions if t.type == "credit"]

    total_spent = sum(t.amount for t in debits)
    total_income = sum(t.amount for t in credits)

    # Spending breakdown by category
    categories = {}
    for t in debits:
        cat = t.category or "General"
        categories[cat] = categories.get(cat, 0) + t.amount

    # Savings rate
    savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0

    # Financial health score (0-100)
    score = 50
    if savings_rate > 20:
        score += 20
    elif savings_rate > 10:
        score += 10
    elif savings_rate < 0:
        score -= 20

    if balance > total_spent:
        score += 15
    elif balance > total_spent * 0.5:
        score += 5
    else:
        score -= 10

    if len(transactions) > 10:
        score += 10  # Active user
    if total_spent > 0 and len(categories) > 1:
        score += 5  # Diversified spending

    score = max(0, min(100, score))

    # Monthly summary
    summary_parts = [f"You spent ₹{total_spent:,.0f} across {len(debits)} transactions."]
    if total_income > 0:
        summary_parts.append(f"Income: ₹{total_income:,.0f}.")
    if categories:
        top_cat = max(categories, key=categories.get)
        summary_parts.append(f"Top spending category: {top_cat} (₹{categories[top_cat]:,.0f}).")
    if savings_rate < 10:
        summary_parts.append("Your savings rate is low — consider cutting discretionary spending.")

    # Prediction
    if balance < total_spent * 0.3:
        prediction = "⚠️ Low balance alert: Your balance may become critically low soon."
    elif savings_rate < 0:
        prediction = "⚠️ You're spending more than you earn. Review your budget."
    else:
        prediction = "Your finances look stable. Keep maintaining your saving habits!"

    return {
        "financialHealthScore": score,
        "monthlySummary": " ".join(summary_parts),
        "prediction": prediction,
        "spendingBreakdown": categories,
        "savingsRate": round(savings_rate, 1),
        "totalSpent": total_spent,
        "totalIncome": total_income,
    }
