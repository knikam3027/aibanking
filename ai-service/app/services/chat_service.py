import os
import re
from app.schemas.models import TransactionItem
from typing import List
from app.services.guardrails import check_guardrails, sanitize_message
from app.services.rag_service import retrieve, augment_with_knowledge, get_ifsc_bank_info
from app.services.transfer_service import parse_transfer_request, format_transfer_prompt, format_transfer_summary

try:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    HAS_OPENAI = bool(os.getenv("OPENAI_API_KEY"))
except Exception:
    client = None
    HAS_OPENAI = False

SYSTEM_PROMPT = """You are an AI banking assistant for a personal finance app. You have access to the user's real financial data provided below. Answer questions accurately based on this data.

Be helpful, concise, and friendly. Use ₹ for currency. Format numbers with commas. If asked about something not in the data, say so honestly. Give actionable financial advice when relevant.

You can help with:
- Balance inquiries
- Spending analysis & category breakdowns
- Saving tips personalized to their spending
- Transaction history
- Loan eligibility guidance
- General financial advice"""


def _build_context(balance: float, transactions: List[TransactionItem]) -> str:
    lines = [f"Current Balance: ₹{balance:,.0f}"]
    if transactions:
        debits = [t for t in transactions if t.type == "debit"]
        credits = [t for t in transactions if t.type == "credit"]
        total_spent = sum(t.amount for t in debits)
        total_income = sum(t.amount for t in credits)
        lines.append(f"Total Spending (recent): ₹{total_spent:,.0f}")
        lines.append(f"Total Income (recent): ₹{total_income:,.0f}")

        categories = {}
        for t in debits:
            cat = t.category or "General"
            categories[cat] = categories.get(cat, 0) + t.amount
        if categories:
            breakdown = ", ".join(f"{k}: ₹{v:,.0f}" for k, v in sorted(categories.items(), key=lambda x: -x[1]))
            lines.append(f"Spending by Category: {breakdown}")

        lines.append(f"\nRecent Transactions ({len(transactions)} total):")
        for t in transactions[:15]:
            arrow = "Debit" if t.type == "debit" else "Credit"
            date_str = t.createdAt[:10] if t.createdAt else "N/A"
            who = t.receiver or t.sender or ""
            lines.append(f"  {arrow}: ₹{t.amount:,.0f} | {t.category or 'General'} | {who} | {date_str}")
    else:
        lines.append("No recent transactions found.")
    return "\n".join(lines)


def _detect_intent(msg: str) -> str:
    """Detect user intent from natural language using flexible pattern matching."""
    msg = msg.lower().strip()

    # Greeting patterns (only short greetings)
    if re.search(r'\b(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|sup|what\'?s\s*up)\b', msg):
        if len(msg.split()) <= 4:
            return "greeting"

    # ---- MOOD DETECTION (check early, very specific phrases) ----
    if re.search(r'\b(stress(ed)?|worried|anxious|nervous|scared|afraid|panic|depress(ed)?|sad|unhappy|frustrated|angry|upset|overwhelm(ed)?|tension|fear|broke|hopeless|drowning|can\'?t\s*(afford|pay|manage)|no\s*money|ruin(ed)?)\b', msg):
        return "mood_stressed"
    if re.search(r'\b(feeling\s*(good|great|rich|wealthy|confident|happy|excited|awesome)|i\'?m\s*(happy|excited|great|confident|proud)|celebrate|good\s*mood)\b', msg):
        return "mood_happy"

    # ---- DIGITAL TWIN (check before spending/prediction — "what if" is unique) ----
    if re.search(r'\b(what\s*if|simulate|simulation|scenario|digital\s*twin|future\s*me|what\s*will\s*happen)\b', msg):
        return "digital_twin"
    if re.search(r'\bif\s*i\s*(reduce|cut|stop|increase|save|spend)\b', msg):
        return "digital_twin"
    if re.search(r'\bcontinue\s*like\s*this|at\s*this\s*rate\b', msg):
        return "digital_twin"

    # ---- GOAL-BASED (check before savings — "save for X" is a goal) ----
    if re.search(r'\b(want\s*to\s*(buy|save\s*for|get|purchase)|sav(e|ing)\s*for\s*(a\s*)?\w+|buy\s*(a\s*)?(car|house|home|bike|laptop|phone|vacation|trip|wedding)|plan(ning)?\s*(for\s*)?(my\s*)?(a\s*)?(car|house|home|bike|wedding|trip|vacation|education|mba)|financial\s*goal|set\s*(a\s*)?goal|my\s*goal)\b', msg):
        return "goals"

    # ---- MICRO-INVESTMENT (check before transactions) ----
    if re.search(r'\b(micro\s*invest\w*|round\s*up|spare\s*change|invest\s*(spare\s*)?change|small\s*invest\w*|auto\s*invest\w*|passive\s*invest\w*|invest\s*automatically|round\s*off)\b', msg):
        return "micro_invest"

    # ---- DEBT KILLER (check before loan) ----
    if re.search(r'\b(debt|repay(ment)?|pay\s*(off|back)|debt\s*free|clear\s*(my\s*)?loan|loan\s*repay|kill\s*debt|debt\s*strategy|how\s*to\s*(repay|clear|pay\s*off))\b', msg):
        return "debt_killer"

    # ---- SUBSCRIPTION MANAGER (check before bills) ----
    if re.search(r'\b(subscription(s)?|recurring\s*(payment|charge)|auto\s*debit|active\s*subs|monthly\s*charges|what\s*am\s*i\s*paying\s*for|cancel\s*(my\s*)?(subscription|sub))\b', msg):
        return "subscriptions"

    # ---- SPENDING COACH (check before general spending) ----
    if re.search(r'\b(coach|habit|bad\s*habit|spending\s*(coach|habit|pattern|behavior|behaviour)|daily\s*(spend|order)|food\s*habit|stop\s*ordering|reduce\s*food|cut\s*(food|shopping|swiggy|zomato)|improve\s*(my\s*)?(spend|habit))\b', msg):
        return "spending_coach"

    # ---- BUDGET GENERATOR (check before savings) ----
    if re.search(r'\b(budget|create\s*(a\s*)?budget|my\s*budget|make\s*(me\s*)?a?\s*budget|budget\s*(plan|planner|generator|for\s*me)|auto\s*budget|generate\s*budget|monthly\s*budget|50.?30.?20)\b', msg):
        return "budget"

    # ---- SMART SAVINGS AUTOMATION ----
    if re.search(r'\b(auto\s*sav\w*|automatic\s*sav\w*|smart\s*sav\w*|save\s*automatic|auto\s*move|auto\s*transfer\s*(to\s*)?sav\w*|salary\s*sav\w*|save\s*after\s*salary)\b', msg):
        return "smart_savings"

    # ---- ANOMALY / ADVANCED FRAUD ----
    if re.search(r'\b(anomal\w*|unusual\s*(spend|transaction|activity|behavio)|suspicious|fraud\s*(detect|check|alert|scan)|security\s*(check|scan)|is\s*my\s*account\s*safe|safe(ty)?|any\s*fraud)\b', msg):
        return "anomaly"

    # ---- CASH FLOW / PREDICTIVE GRAPH ----
    if re.search(r'\b(cash\s*flow|money\s*flow|income\s*vs\s*expense|flow\s*graph|balance\s*trend|7\s*day|30\s*day|week\s*forecast|month\s*forecast|project(ed|ion)?)\b', msg):
        return "cashflow"

    # ---- MONEY TRANSFER VIA CHAT ----
    if re.search(r'\b(transfer|send\s*money|pay\s*(to|someone)|bhej|paisa\s*bhej|wire|remit|neft\s*(transfer|send|kar)|money\s*send|send\s*\d+|transfer\s*\d+|pay\s*\d+)\b', msg):
        return "transfer_money"

    # ---- IFSC LOOKUP ----
    if re.search(r'\b(ifsc|bank\s*code|branch\s*code|which\s*bank|bank\s*name)\b', msg):
        # Check if there's an actual IFSC code in the message
        if re.search(r'[A-Z]{4}0[A-Z0-9]{6}', msg.upper()):
            return "ifsc_lookup"
        return "ifsc_lookup"

    # ---- INVESTMENT ADVISOR ----
    if re.search(r'\b(invest(ment|ing)?|where\s*(to|should)\s*invest|best\s*invest|sip|mutual\s*fund|fd|fixed\s*deposit|stock|share\s*market|gold\s*(invest|buy)|ppf|nps|elss|invest\s*advice|portfolio|diversif)\b', msg):
        if not re.search(r'micro\s*invest', msg):  # don't override micro_invest
            return "investment_advisor"

    # ---- TAX PLANNING ----
    if re.search(r'\b(tax|80c|80d|hra|income\s*tax|tax\s*sav|tax\s*plan|section\s*80|deduction|itr|tax\s*filing|how\s*to\s*save\s*tax|tax\s*benefit|tax\s*free|exempt)\b', msg):
        return "tax_planning"

    # ---- FINANCIAL QUIZ ----
    if re.search(r'\b(quiz|test\s*(my|me)|financial\s*(quiz|test|literacy)|money\s*quiz|banking\s*quiz|challenge\s*me|trivia)\b', msg):
        return "finance_quiz"

    # ---- BANKING KNOWLEDGE (RAG-enhanced) ----
    if re.search(r'\b(what\s*is\s*(neft|rtgs|imps|upi|fd|sip|mutual\s*fund|emi|kyc|cibil)|how\s*does\s*(neft|rtgs|imps|upi)\s*work|explain\s*(neft|rtgs|imps|upi|fd|insurance|tax)|tell\s*me\s*about\s*(neft|rtgs|imps|banking|invest|insurance|tax|loan\s*type))\b', msg):
        return "knowledge_query"

    # ---- HINDI / MULTI-LANGUAGE ----
    if re.search(r'\b(mera|kya|hai|kitna|paisa|kharch|bachat|balance\s*kya|meri|batao|dikhao|kharcha|kaisa|loan\s*milega|paise|jama|nikala|hisab)\b', msg):
        return "hindi"

    # ---- STANDARD INTENTS (original order) ----

    # Balance inquiry
    if re.search(r'\b(balance|how\s*much\s*(do\s*i\s*have|money|in\s*my|left|remaining)|current\s*amount|account\s*(amount|total|summary)|what\'?s?\s*(my|the)?\s*(balance|money|amount)|show\s*(my\s*)?(balance|money)|check\s*(my\s*)?(balance|account))\b', msg):
        return "balance"

    # Recent transactions
    if re.search(r'\b(transactions?|transtion|trastion|trasaction|recent|history|last\s*(few|couple|some)?\s*(transactions?|payments?|transfers?|debits?|credits?)|show\s*(me\s*)?(my\s*)?(transactions?|payments?|history|activity)|what\s*(did|have)?\s*(my|i)\s*(pay|paid|sent|received|done)|my\s*(recent|last|latest)\s*(transactions?|payments?|activity|transfers?)|list\s*(my\s*)?(transactions?|payments?)|payment\s*history|activity\s*log)\b', msg):
        return "transactions"

    # Spending analysis
    if re.search(r'\b(spend|spent|spending|expenses?|expenditure|how\s*much\s*(did\s*i|have\s*i|i)\s*(spend|spent|paid|pay)|where\s*(did\s*)?(is\s*)?(my\s*)?(money|funds?)\s*(go|going|went)|money\s*spent|cost|outgoing|debit(s|ed)?|show\s*(me\s*)?(my\s*)?(spend|expenses?|cost)|tell\s*(me\s*)?(about\s*)?(my\s*)?(spend|expenses?|cost))\b', msg):
        # Check for specific category
        for cat in ["food", "shopping", "bills", "rent", "entertainment", "transfer", "transport", "health", "education"]:
            if cat in msg:
                return f"spending_{cat}"
        return "spending"

    # Improve credit/CIBIL score (check BEFORE savings and basic cibil check)
    if re.search(r'\b(improv|increase|raise|boost|build|better)\w*\s*(my\s*)?(cibil|cbill|credit\s*score|score)|how\s*to\s*(improv|increase|raise|boost|build|get\s*better)\w*\s*(my\s*)?(cibil|cbill|credit\s*score|score)|tips?\s*(to|for)\s*(improv|increase|raise)\w*\s*(cibil|cbill|credit|score)\b', msg):
        return "improve_cibil"

    # Saving tips
    if re.search(r'\b(sav(e|ing|ings)|budget|cut\s*(cost|expense|spending)|reduce\s*(spend|expense|cost)|money\s*tip|financial\s*tip|financial\s*advice|how\s*(to|can\s*i)\s*save|tip(s)?|advice|suggest|recommendation|improve\s*(my\s*)?(finance|saving|money)|help\s*(me\s*)?(save|budget))\b', msg):
        return "savings"

    # CIBIL / Credit score check
    if re.search(r'\b(cibil|cbill|credit\s*score|my\s*score|cibil\s*score|check\s*(my\s*)?score|what\s*(is\s*)?(my\s*)?score|what\s*(is\s*)?(my\s*)?(cibil|cbill|credit)|show\s*(my\s*)?(cibil|credit)\s*score)\b', msg):
        return "cibil_score"

    # Loan related
    if re.search(r'\b(loan|borrow|emi|eligib|interest\s*rate|can\s*i\s*(get|take|borrow)|lending)\b', msg):
        return "loan"

    # Financial health / insights
    if re.search(r'\b(health|score|insight|analysis|analy[sz]e|overview|summary|report|how\s*am\s*i\s*doing|financial\s*(health|status|condition|situation)|am\s*i\s*(doing\s*)?(ok|good|well|bad))\b', msg):
        return "insights"

    # Prediction
    if re.search(r'\b(predict|forecast|future|next\s*(week|month)|will\s*(i|my)|upcoming|expect|run\s*out|low\s*balance|enough\s*money)\b', msg):
        return "prediction"

    # Thank you
    if re.search(r'\b(thank|thanks|thx|ty|appreciate)\b', msg):
        return "thanks"

    # Farewell
    if re.search(r'\b(bye|goodbye|see\s*you|good\s*night|take\s*care)\b', msg):
        return "farewell"

    # Help
    if re.search(r'\b(help|what\s*can\s*you\s*do|feature|command|option|menu|how\s*does\s*this\s*work)\b', msg):
        return "help"

    return "unknown"


def _smart_reply(message: str, balance: float, transactions: List[TransactionItem]) -> str:
    """Generate intelligent replies based on detected intent."""
    intent = _detect_intent(message)
    debits = [t for t in transactions if t.type == "debit"]
    credits = [t for t in transactions if t.type == "credit"]
    total_spent = sum(t.amount for t in debits)
    total_income = sum(t.amount for t in credits)

    if intent == "greeting":
        return (
            f"Hello! 👋 Welcome to AI Banking Assistant.\n\n"
            f"Your current balance is ₹{balance:,.0f}.\n\n"
            f"I can help you with:\n"
            f"• Check your balance\n"
            f"• View recent transactions\n"
            f"• Analyze your spending\n"
            f"• Get personalized saving tips\n"
            f"• Check loan eligibility\n"
            f"• Predict future expenses\n\n"
            f"What would you like to know?"
        )

    if intent == "balance":
        result = f"💰 Your current account balance is ₹{balance:,.0f}."
        if debits:
            avg_daily = total_spent / max(len(debits), 1)
            result += f"\n\nYour average transaction is ₹{avg_daily:,.0f}."
            if balance > 0:
                days_left = int(balance / avg_daily) if avg_daily > 0 else 999
                if days_left < 30:
                    result += f"\n⚠️ At your current spending rate, your balance may last about {days_left} days."
                else:
                    result += f"\n✅ Your balance looks healthy for the coming weeks."
        return result

    if intent == "transactions":
        recent = transactions[:10]
        if not recent:
            return "📋 You don't have any transactions yet. Start by making a transfer!"

        lines = [f"📋 Your last {len(recent)} transactions:\n"]
        for t in recent:
            emoji = "🔴" if t.type == "debit" else "🟢"
            direction = "Sent to" if t.type == "debit" else "Received from"
            who = t.receiver if t.type == "debit" else (t.sender or "—")
            date = t.createdAt[:10] if t.createdAt else ""
            lines.append(f"{emoji} {direction} {who}: ₹{t.amount:,.0f} ({t.category or 'General'}) {date}")

        lines.append(f"\n💸 Total spent: ₹{total_spent:,.0f} | 💰 Total received: ₹{total_income:,.0f}")
        return "\n".join(lines)

    if intent.startswith("spending_") and intent != "spending_coach":
        category = intent.replace("spending_", "").capitalize()
        cat_debits = [t for t in debits if (t.category or "").lower() == category.lower()]
        cat_total = sum(t.amount for t in cat_debits)
        if cat_debits:
            pct = (cat_total / total_spent * 100) if total_spent > 0 else 0
            return (
                f"🛍️ {category} Spending Analysis:\n\n"
                f"• Total spent on {category}: ₹{cat_total:,.0f}\n"
                f"• Number of transactions: {len(cat_debits)}\n"
                f"• Average per transaction: ₹{cat_total / len(cat_debits):,.0f}\n"
                f"• {pct:.1f}% of your total spending\n\n"
                f"{'⚠️ This is a significant portion of your expenses. Consider setting a budget for ' + category + '.' if pct > 30 else '✅ This seems reasonable compared to your total spending.'}"
            )
        return f"📊 You haven't spent anything on {category} in your recent transactions."

    if intent == "spending":
        if not debits:
            return "📊 You haven't made any spending transactions yet."

        categories = {}
        for t in debits:
            cat = t.category or "General"
            categories[cat] = categories.get(cat, 0) + t.amount

        sorted_cats = sorted(categories.items(), key=lambda x: -x[1])
        lines = [f"📊 Spending Analysis:\n"]
        lines.append(f"💸 Total spent: ₹{total_spent:,.0f} across {len(debits)} transactions\n")
        lines.append("Category Breakdown:")
        for cat, amt in sorted_cats:
            pct = (amt / total_spent * 100) if total_spent > 0 else 0
            bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            lines.append(f"  {cat}: ₹{amt:,.0f} ({pct:.0f}%) {bar}")

        top_cat = sorted_cats[0][0] if sorted_cats else "N/A"
        lines.append(f"\n🏆 Top spending category: {top_cat}")

        if total_income > 0:
            savings_rate = ((total_income - total_spent) / total_income) * 100
            lines.append(f"💰 Savings rate: {savings_rate:.1f}%")
            if savings_rate < 10:
                lines.append("⚠️ Your savings rate is low. Try to reduce non-essential spending.")
            elif savings_rate > 30:
                lines.append("✅ Great savings rate! Keep it up!")

        return "\n".join(lines)

    if intent == "savings":
        lines = ["💡 Personalized Saving Tips:\n"]

        # Analyze their actual data
        categories = {}
        for t in debits:
            cat = t.category or "General"
            categories[cat] = categories.get(cat, 0) + t.amount

        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0

        lines.append(f"📊 Your current numbers:")
        lines.append(f"  • Balance: ₹{balance:,.0f}")
        lines.append(f"  • Total spent: ₹{total_spent:,.0f}")
        lines.append(f"  • Savings rate: {savings_rate:.1f}%\n")

        lines.append("🎯 Tips tailored to your spending:\n")

        tip_num = 1
        # 50/30/20 rule
        lines.append(f"{tip_num}. Follow the 50/30/20 Rule:")
        lines.append(f"   • 50% for needs (rent, bills, food)")
        lines.append(f"   • 30% for wants (shopping, entertainment)")
        lines.append(f"   • 20% for savings & investments")
        tip_num += 1

        # Category-specific tips
        for cat, amt in sorted(categories.items(), key=lambda x: -x[1]):
            pct = (amt / total_spent * 100) if total_spent > 0 else 0
            if cat.lower() in ["shopping", "entertainment"] and pct > 25:
                lines.append(f"\n{tip_num}. Your {cat} spending is {pct:.0f}% of total — try setting a weekly budget of ₹{amt / 4:,.0f}.")
                tip_num += 1
            elif cat.lower() == "food" and pct > 35:
                lines.append(f"\n{tip_num}. Food is {pct:.0f}% of spending. Try meal planning and cooking at home to reduce this.")
                tip_num += 1

        lines.append(f"\n{tip_num}. Set up automatic savings — move 10-20% of income to savings right when you receive it.")
        tip_num += 1
        lines.append(f"\n{tip_num}. Review subscriptions monthly and cancel unused services.")
        tip_num += 1
        lines.append(f"\n{tip_num}. Build an emergency fund of 3-6 months of expenses (target: ₹{total_spent * 3:,.0f} - ₹{total_spent * 6:,.0f}).")

        if savings_rate < 10:
            lines.append(f"\n⚠️ Your savings rate is only {savings_rate:.1f}%. Immediate action needed!")
        elif savings_rate < 20:
            lines.append(f"\n📈 Savings rate of {savings_rate:.1f}% is decent, but aim for 20%+.")
        else:
            lines.append(f"\n✅ Great job! Your {savings_rate:.1f}% savings rate is excellent!")

        # Current market situation advisory
        lines.append(f"\n{'━' * 30}")
        lines.append(f"🌍 **Current Market Advisory (April 2026)**\n")
        lines.append(f"⚠️ **Geopolitical Alert:** Iran-USA tensions are elevated.")
        lines.append(f"   Stock markets globally are experiencing high volatility.\n")
        lines.append(f"📉 **What this means for you:**")
        lines.append(f"   • Avoid aggressive equity/stock market investments right now")
        lines.append(f"   • Existing SIPs can continue (cost averaging helps in dips)")
        lines.append(f"   • Do NOT panic sell existing holdings\n")
        lines.append(f"✅ **Safe havens to consider:**")
        lines.append(f"   • 🥇 **Gold** — prices rise during geopolitical uncertainty")
        lines.append(f"   • 🥈 **Silver** — affordable alternative to gold")
        lines.append(f"   • 🏦 **Fixed Deposits** — guaranteed returns, zero risk")
        lines.append(f"   • 📜 **Government Bonds / Sovereign Gold Bonds** — safe + tax benefits")
        lines.append(f"   • 💰 **Liquid/Debt Mutual Funds** — low risk, better than savings account\n")
        lines.append(f"💡 **Pro Tip:** Keep 6 months expenses in cash/liquid fund before investing anywhere.")

        return "\n".join(lines)

    if intent == "cibil_score":
        # Calculate AI-based CIBIL score (700-900) from user financial data
        score = 700
        # Balance factor
        if balance >= 50000:
            score += 40
        elif balance >= 20000:
            score += 25
        elif balance >= 10000:
            score += 15
        elif balance >= 5000:
            score += 5

        # Transaction history factor
        if len(transactions) >= 30:
            score += 35
        elif len(transactions) >= 15:
            score += 25
        elif len(transactions) >= 5:
            score += 15
        elif len(transactions) >= 1:
            score += 5

        # Income vs spending factor
        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
        if savings_rate >= 30:
            score += 40
        elif savings_rate >= 20:
            score += 30
        elif savings_rate >= 10:
            score += 20
        elif savings_rate > 0:
            score += 10

        # Regular income factor
        if total_income > 0:
            score += 20

        # Failed/blocked transactions penalty
        failed = sum(1 for t in transactions if t.status in ("failed", "blocked"))
        score -= failed * 15

        # Diverse spending (active financial life)
        categories = set(t.category for t in transactions if t.category)
        if len(categories) >= 4:
            score += 15
        elif len(categories) >= 2:
            score += 8

        # Clamp between 700-900
        score = max(700, min(900, score))

        # Rating
        if score >= 850:
            rating = "🟢 Excellent"
            remark = "Outstanding! You have a top-tier credit profile."
        elif score >= 800:
            rating = "🟢 Very Good"
            remark = "Great financial health. You qualify for premium offers."
        elif score >= 750:
            rating = "🟡 Good"
            remark = "Solid score. Most loans and credit cards are accessible."
        elif score >= 725:
            rating = "🟠 Fair"
            remark = "Decent, but there's room for improvement."
        else:
            rating = "🔴 Needs Improvement"
            remark = "Work on building your financial profile."

        lines = [
            f"📊 Your AI-Based CIBIL Score\n",
            f"┌─────────────────────────────┐",
            f"│   CIBIL Score:  {score}         │",
            f"│   Rating:  {rating}       │",
            f"└─────────────────────────────┘\n",
            f"{remark}\n",
            f"📋 Score Breakdown:\n",
            f"  💰 Balance factor:         {'✅ Good' if balance >= 10000 else '⚠️ Low'}",
            f"  📝 Transaction history:    {'✅ Active' if len(transactions) >= 10 else '⚠️ Limited'}",
            f"  📈 Savings rate:           {savings_rate:.1f}% {'✅' if savings_rate >= 20 else '⚠️'}",
            f"  💵 Regular income:         {'✅ Yes' if total_income > 0 else '❌ No income detected'}",
            f"  🚫 Failed transactions:    {failed} {'✅' if failed == 0 else '⚠️ Penalty applied'}",
            f"  🏷️ Spending diversity:     {len(categories)} categories {'✅' if len(categories) >= 3 else '⚠️'}\n",
            f"💡 Want to improve your score? Ask me: \"How to improve my CIBIL score?\""
        ]
        return "\n".join(lines)

    if intent == "improve_cibil":
        # Calculate current score for reference
        score = 700
        if balance >= 50000: score += 40
        elif balance >= 20000: score += 25
        elif balance >= 10000: score += 15
        if len(transactions) >= 30: score += 35
        elif len(transactions) >= 15: score += 25
        elif len(transactions) >= 5: score += 15
        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
        if savings_rate >= 30: score += 40
        elif savings_rate >= 20: score += 30
        elif savings_rate >= 10: score += 20
        if total_income > 0: score += 20
        failed = sum(1 for t in transactions if t.status in ("failed", "blocked"))
        score -= failed * 15
        categories = set(t.category for t in transactions if t.category)
        if len(categories) >= 4: score += 15
        elif len(categories) >= 2: score += 8
        score = max(700, min(900, score))

        lines = [
            f"📈 How to Improve Your CIBIL Score\n",
            f"Your current AI score: {score}/900\n",
            f"Here are personalized tips based on YOUR financial data:\n",
        ]

        tip = 1
        # Personalized tips based on weak areas
        if balance < 10000:
            lines.append(f"{tip}. 💰 Increase Your Account Balance")
            lines.append(f"   Current: ₹{balance:,.0f} — Try to maintain ₹10,000+ at all times.")
            lines.append(f"   Impact: Can boost your score by up to +25 points.\n")
            tip += 1

        if len(transactions) < 15:
            lines.append(f"{tip}. 📝 Build Transaction History")
            lines.append(f"   Current: {len(transactions)} transactions — Aim for 15+ regular transactions.")
            lines.append(f"   Use digital payments for bills, recharges, and daily purchases.")
            lines.append(f"   Impact: Can boost your score by up to +25 points.\n")
            tip += 1

        if savings_rate < 20:
            lines.append(f"{tip}. 📊 Improve Your Savings Rate")
            lines.append(f"   Current: {savings_rate:.1f}% — Target at least 20%.")
            lines.append(f"   Reduce non-essential spending and save ₹{max(1000, int(total_spent * 0.1)):,} more.")
            lines.append(f"   Impact: Can boost your score by up to +30 points.\n")
            tip += 1

        if total_income == 0:
            lines.append(f"{tip}. 💵 Show Regular Income")
            lines.append(f"   No income deposits detected. Regular salary/income credits improve your profile significantly.")
            lines.append(f"   Impact: Can boost your score by +20 points.\n")
            tip += 1

        if failed > 0:
            lines.append(f"{tip}. 🚫 Avoid Failed/Blocked Transactions")
            lines.append(f"   You have {failed} failed/blocked transaction(s). Each one reduces your score by 15 points.")
            lines.append(f"   Ensure sufficient balance before transfers.")
            lines.append(f"   Impact: Removing penalties can recover +{failed * 15} points.\n")
            tip += 1

        if len(categories) < 4:
            lines.append(f"{tip}. 🏷️ Diversify Your Spending")
            lines.append(f"   Current: {len(categories)} categories — Use 4+ categories (food, bills, shopping, etc.)")
            lines.append(f"   This shows active and balanced financial behavior.")
            lines.append(f"   Impact: Can boost your score by up to +15 points.\n")
            tip += 1

        # General tips
        lines.append(f"{tip}. 🏦 Pay Bills On Time")
        lines.append(f"   Timely bill payments (electricity, phone, rent) build a strong credit history.\n")
        tip += 1

        lines.append(f"{tip}. 📱 Use UPI & Digital Payments")
        lines.append(f"   Regular UPI/digital payment activity is factored into AI-based scoring.\n")
        tip += 1

        lines.append(f"{tip}. ⏳ Be Patient & Consistent")
        lines.append(f"   Credit scores improve over time with consistent good habits.")
        lines.append(f"   Check your score regularly to track progress.\n")

        # Score projection
        potential = min(900, score + 50)
        lines.append(f"🎯 If you follow these tips, your score could reach {potential}+ within a few months!")

        return "\n".join(lines)

    if intent == "loan":
        return (
            f"🏦 Loan Information:\n\n"
            f"Based on your financial profile:\n"
            f"• Balance: ₹{balance:,.0f}\n"
            f"• Recent transactions: {len(transactions)}\n"
            f"• Income: ₹{total_income:,.0f}\n\n"
            f"To check your exact eligibility and get an AI-powered credit score, "
            f"go to the **Loans** page in the app.\n\n"
            f"💡 Tips to improve loan eligibility:\n"
            f"• Maintain a higher account balance\n"
            f"• Have regular income deposits\n"
            f"• Avoid failed/blocked transactions\n"
            f"• Build a longer transaction history"
        )

    if intent == "insights":
        if not transactions:
            return "📊 Not enough data for insights yet. Make some transactions first!"

        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
        health = min(100, max(0, int(50 + savings_rate)))

        status = "🟢 Healthy" if health >= 70 else ("🟡 Fair" if health >= 40 else "🔴 Needs Attention")

        return (
            f"📊 Financial Health Overview:\n\n"
            f"🏥 Health Score: {health}/100 — {status}\n"
            f"💰 Balance: ₹{balance:,.0f}\n"
            f"💸 Total Spent: ₹{total_spent:,.0f}\n"
            f"💵 Total Income: ₹{total_income:,.0f}\n"
            f"📈 Savings Rate: {savings_rate:.1f}%\n"
            f"📝 Transactions: {len(transactions)}\n\n"
            f"{'✅ You are managing your finances well!' if health >= 70 else '⚠️ Consider reducing spending and increasing savings.'}\n\n"
            f"Visit the **Insights** page for detailed charts and breakdown."
        )

    if intent == "prediction":
        if not debits:
            return "🔮 Not enough spending data to make predictions. Use the app more!"
        avg_daily = total_spent / max(len(debits), 1)
        predicted_weekly = avg_daily * 7
        days_left = int(balance / avg_daily) if avg_daily > 0 else 999

        result = f"🔮 Financial Prediction:\n\n"
        result += f"• Average spending per transaction: ₹{avg_daily:,.0f}\n"
        result += f"• Estimated weekly expense: ₹{predicted_weekly:,.0f}\n"
        result += f"• Balance may last: ~{days_left} days\n\n"

        if days_left < 7:
            result += "🚨 Critical: You may run out of funds this week! Reduce spending immediately."
        elif days_left < 14:
            result += "⚠️ Warning: Balance may become low within 2 weeks."
        elif days_left < 30:
            result += "📢 Your balance should last about a month at this rate."
        else:
            result += "✅ Your balance looks comfortable for the foreseeable future."

        return result

    # ---- EMOTION-AWARE RESPONSES ----
    if intent == "mood_stressed":
        lines = ["😔 I understand you're feeling stressed about finances. Let me help.\n"]
        lines.append(f"📊 Here's your current situation:\n")
        lines.append(f"  💰 Balance: ₹{balance:,.0f}")
        lines.append(f"  💸 Total spending: ₹{total_spent:,.0f}")
        lines.append(f"  💵 Total income: ₹{total_income:,.0f}\n")

        # Reassuring data-based advice
        if balance > 10000:
            lines.append("✅ Your account still has a healthy balance. Don't panic!\n")
        elif balance > 0:
            lines.append("⚠️ Balance is getting low, but we can fix this!\n")

        lines.append("🧘 Here are some calming steps:\n")
        lines.append("1. 🛑 **Pause non-essential spending** for 7 days")
        lines.append(f"   This could save you ~₹{int(total_spent * 0.3 / 4):,} per week\n")
        lines.append("2. 📋 **List your essentials only**: rent, food, transport, bills")
        lines.append("   Everything else can wait\n")
        lines.append("3. 💰 **Set a strict daily budget**")
        lines.append(f"   Try ₹{max(200, int(balance / 30)):,}/day for daily expenses\n")
        lines.append("4. 📱 **Avoid impulse purchases** — wait 24 hours before buying")
        lines.append("5. 🏦 **Talk to us** about EMI restructuring if you have loans\n")
        lines.append("Remember: Financial stress is temporary. Small steps add up! 💪")
        lines.append("I'm here to help you any time. Ask me about saving tips or budget planning.")
        return "\n".join(lines)

    if intent == "mood_happy":
        lines = ["🎉 Great to hear you're in a good mood! Let's make your money grow!\n"]
        lines.append(f"💰 Balance: ₹{balance:,.0f}\n")
        lines.append("Since you're feeling confident, here are some growth opportunities:\n")

        if balance >= 50000:
            lines.append("🚀 **Growth Suggestions:**\n")
            lines.append(f"1. 📈 Invest ₹{int(balance * 0.2):,} in a mutual fund SIP")
            lines.append("   Historical returns: 12-15% annually\n")
            lines.append(f"2. 🏦 Put ₹{int(balance * 0.1):,} in a Fixed Deposit")
            lines.append("   Safe guaranteed returns: 7-8% annually\n")
            lines.append(f"3. 💎 Start a gold SIP with ₹{min(5000, int(balance * 0.05)):,}/month")
            lines.append("   Hedge against inflation\n")
        elif balance >= 20000:
            lines.append("📈 **Smart Moves:**\n")
            lines.append(f"1. Start a ₹{min(5000, int(balance * 0.15)):,}/month SIP in index funds")
            lines.append("2. Build an emergency fund (target: ₹{:,})".format(int(total_spent * 3)))
            lines.append("3. Consider a recurring deposit for disciplined saving\n")
        else:
            lines.append("📊 **Quick Wins:**\n")
            lines.append("1. Start saving even ₹500/month — consistency matters!")
            lines.append("2. Use cashback offers on bill payments")
            lines.append("3. Set a small weekly savings target\n")

        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
        if savings_rate > 20:
            lines.append(f"🌟 Your savings rate of {savings_rate:.1f}% is excellent! Keep the momentum going!")
        return "\n".join(lines)

    # ---- GOAL-BASED BANKING ----
    if intent == "goals":
        msg_lower = message.lower()
        lines = ["🎯 Goal-Based Banking Planner\n"]

        # Detect specific goals
        goals = []
        if re.search(r'car', msg_lower): goals.append(("🚗 Car", 800000))
        if re.search(r'house|home|flat', msg_lower): goals.append(("🏠 House Down Payment", 2000000))
        if re.search(r'bike|motorcycle', msg_lower): goals.append(("🏍️ Bike", 150000))
        if re.search(r'laptop|computer', msg_lower): goals.append(("💻 Laptop", 80000))
        if re.search(r'phone|iphone|mobile', msg_lower): goals.append(("📱 Phone", 50000))
        if re.search(r'trip|travel|vacation|holiday', msg_lower): goals.append(("✈️ Vacation", 100000))
        if re.search(r'wedding|marriage', msg_lower): goals.append(("💒 Wedding", 500000))
        if re.search(r'education|course|study|mba', msg_lower): goals.append(("🎓 Education", 300000))

        if not goals:
            goals = [("🎯 General Goal", 100000)]

        monthly_savings = max(1000, int((total_income - total_spent) if total_income > total_spent else balance * 0.1))

        for name, target in goals:
            months = int(target / monthly_savings) if monthly_savings > 0 else 999
            years = months / 12

            lines.append(f"━━━ {name} (₹{target:,}) ━━━\n")
            lines.append(f"  💰 Your monthly savings capacity: ₹{monthly_savings:,}")
            lines.append(f"  📅 Time to reach goal: ~{months} months ({years:.1f} years)")
            lines.append(f"  📊 Progress from current balance: {min(100, int(balance / target * 100))}%\n")

            # AI allocation plan
            lines.append(f"  🤖 AI Recommended Plan:")
            lines.append(f"     • Monthly SIP: ₹{int(monthly_savings * 0.6):,} (60%) → Mutual Funds")
            lines.append(f"     • Fixed Deposit: ₹{int(monthly_savings * 0.25):,} (25%) → Safe")
            lines.append(f"     • Liquid Fund: ₹{int(monthly_savings * 0.15):,} (15%) → Easy access\n")

            if months > 24:
                lines.append(f"  💡 Tip: Increase income by ₹{int(monthly_savings * 0.5):,}/month to halve the time!")
            elif months > 12:
                lines.append(f"  💡 Tip: A 10% salary raise could cut this to {int(months * 0.7)} months!")
            else:
                lines.append(f"  ✅ Very achievable! Stay consistent!\n")

        lines.append("\n📌 Tell me your goal (e.g., 'I want to buy a car') for a personalized plan!")
        return "\n".join(lines)

    # ---- SUBSCRIPTION MANAGER ----
    if intent == "subscriptions":
        subs_keywords = {
            'Netflix': 499, 'Spotify': 199, 'Amazon Prime': 599, 'YouTube Premium': 179,
            'Hotstar': 299, 'Jio': 1200, 'Airtel': 999, 'Vi': 899,
            'Apple Music': 99, 'Zee5': 499, 'SonyLiv': 399, 'Disney+': 299,
            'LinkedIn Premium': 1999, 'iCloud': 75, 'Google One': 130,
        }

        # Detect from transaction data
        found_subs = []
        total_sub_cost = 0
        for t in debits:
            desc = (t.category or '').lower() + ' ' + (t.receiver or '').lower()
            for sub_name, typical_cost in subs_keywords.items():
                if sub_name.lower() in desc or sub_name.lower().replace(' ', '') in desc.replace(' ', ''):
                    found_subs.append({"name": sub_name, "cost": t.amount, "date": t.createdAt[:10] if t.createdAt else "N/A"})
                    total_sub_cost += t.amount
                    break

        lines = ["📱 AI Subscription Manager\n"]

        if found_subs:
            lines.append(f"Found {len(found_subs)} active subscription(s):\n")
            for s in found_subs:
                lines.append(f"  {'🔴' if s['cost'] > 500 else '🟡' if s['cost'] > 200 else '🟢'} {s['name']}: ₹{s['cost']:,}/month (charged {s['date']})")

            lines.append(f"\n💸 Total monthly subscription cost: ₹{total_sub_cost:,}")
            lines.append(f"📅 Annual cost: ₹{total_sub_cost * 12:,}\n")

            # AI recommendations
            lines.append("🤖 AI Recommendations:\n")
            sub_pct = (total_sub_cost / total_income * 100) if total_income > 0 else 0
            if sub_pct > 10:
                lines.append(f"⚠️ Subscriptions are {sub_pct:.1f}% of income — that's too high!")
                lines.append("Consider keeping only your top 2 most-used services.\n")
            elif sub_pct > 5:
                lines.append(f"📊 Subscriptions are {sub_pct:.1f}% of income — moderate.")
                lines.append("Review which ones you actually use weekly.\n")
            else:
                lines.append(f"✅ Subscriptions are only {sub_pct:.1f}% of income — looks fine!\n")

            # Check for overlapping services
            ott_subs = [s for s in found_subs if any(x in s['name'].lower() for x in ['netflix', 'prime', 'hotstar', 'zee5', 'sonyliv', 'disney'])]
            if len(ott_subs) > 2:
                lines.append(f"🔴 You have {len(ott_subs)} OTT platforms — consider keeping max 2")
                lines.append(f"   Potential savings: ₹{sum(s['cost'] for s in sorted(ott_subs, key=lambda x: x['cost'])[:-2]):,}/month\n")
        else:
            lines.append("No subscriptions detected in recent transactions.\n")
            lines.append("💡 Common subscriptions to track:")
            lines.append("   Netflix, Spotify, Amazon Prime, YouTube Premium, Hotstar")
            lines.append("   Jio, Airtel, iCloud, Google One\n")

        lines.append("🔔 I'll alert you before renewals. Ask me anytime to review!")
        return "\n".join(lines)

    # ---- DIGITAL TWIN / WHAT-IF SIMULATOR ----
    if intent == "digital_twin":
        lines = ["🔮 Digital Twin — Future Financial Simulation\n"]
        lines.append(f"📊 Current Snapshot:")
        lines.append(f"   Balance: ₹{balance:,.0f}")
        lines.append(f"   Monthly spending: ~₹{total_spent:,.0f}")
        lines.append(f"   Monthly income: ~₹{total_income:,.0f}\n")

        monthly_net = total_income - total_spent

        # 6-month projection: as-is
        lines.append("━━━ Scenario 1: Continue As-Is ━━━")
        proj_6m = balance + (monthly_net * 6)
        proj_12m = balance + (monthly_net * 12)
        lines.append(f"   6 months: ₹{max(0, proj_6m):,.0f}")
        lines.append(f"   12 months: ₹{max(0, proj_12m):,.0f}")
        if monthly_net > 0:
            lines.append(f"   ✅ You'll save ₹{monthly_net * 12:,.0f} in a year\n")
        else:
            months_to_zero = int(balance / abs(monthly_net)) if monthly_net < 0 else 999
            lines.append(f"   ⚠️ Balance hits ₹0 in ~{months_to_zero} months!\n")

        # Scenario 2: Cut spending 10%
        reduced_spend = total_spent * 0.9
        net_10cut = total_income - reduced_spend
        lines.append("━━━ Scenario 2: Cut Spending by 10% ━━━")
        lines.append(f"   New monthly spending: ₹{reduced_spend:,.0f}")
        lines.append(f"   6 months: ₹{max(0, balance + net_10cut * 6):,.0f}")
        lines.append(f"   12 months: ₹{max(0, balance + net_10cut * 12):,.0f}")
        lines.append(f"   💰 Extra savings: ₹{total_spent * 0.1 * 12:,.0f}/year\n")

        # Scenario 3: Cut spending 20%
        reduced_spend_20 = total_spent * 0.8
        net_20cut = total_income - reduced_spend_20
        lines.append("━━━ Scenario 3: Cut Spending by 20% ━━━")
        lines.append(f"   New monthly spending: ₹{reduced_spend_20:,.0f}")
        lines.append(f"   6 months: ₹{max(0, balance + net_20cut * 6):,.0f}")
        lines.append(f"   12 months: ₹{max(0, balance + net_20cut * 12):,.0f}")
        lines.append(f"   💰 Extra savings: ₹{total_spent * 0.2 * 12:,.0f}/year\n")

        # Investment projection
        if monthly_net > 0:
            lines.append("━━━ Scenario 4: Invest Savings (12% returns) ━━━")
            invested = monthly_net * 12
            with_returns = invested * 1.12
            lines.append(f"   If you invest ₹{monthly_net:,.0f}/month for 1 year")
            lines.append(f"   Principal: ₹{invested:,.0f}")
            lines.append(f"   With 12% returns: ₹{with_returns:,.0f}")
            lines.append(f"   Bonus earnings: ₹{with_returns - invested:,.0f} 🎉\n")

        # Top spending category reduction tip
        categories = {}
        for t in debits:
            cat = t.category or "General"
            categories[cat] = categories.get(cat, 0) + t.amount
        if categories:
            top_cat = max(categories, key=categories.get)
            top_amt = categories[top_cat]
            lines.append(f"💡 Quick Win: Reduce {top_cat} spending by 15%")
            lines.append(f"   Current: ₹{top_amt:,.0f} → Target: ₹{int(top_amt * 0.85):,}")
            lines.append(f"   Annual saving: ₹{int(top_amt * 0.15 * 12):,}")

        return "\n".join(lines)

    # ---- MICRO-INVESTMENT ENGINE ----
    if intent == "micro_invest":
        lines = ["💎 AI Micro-Investment Engine\n"]
        lines.append("Round up every transaction and invest the spare change!\n")

        # Calculate round-ups from actual transactions
        total_roundup = 0
        examples = []
        for t in debits[:20]:
            remainder = t.amount % 100
            if remainder > 0:
                roundup = 100 - remainder
                total_roundup += roundup
                if len(examples) < 5:
                    examples.append(f"   ₹{t.amount:,.0f} → rounded to ₹{t.amount + roundup:,.0f} → ₹{roundup} invested")

        lines.append("📋 How it works with YOUR transactions:\n")
        for ex in examples:
            lines.append(ex)

        lines.append(f"\n💰 From your last {min(20, len(debits))} transactions:")
        lines.append(f"   Total round-up amount: ₹{total_roundup:,}")
        lines.append(f"   Monthly estimate: ~₹{total_roundup * 2:,}")
        lines.append(f"   Annual estimate: ~₹{total_roundup * 24:,}\n")

        # Investment growth projection
        monthly_invest = total_roundup * 2
        annual = monthly_invest * 12
        with_returns_1y = annual * 1.12
        with_returns_3y = monthly_invest * 36 * 1.40
        with_returns_5y = monthly_invest * 60 * 1.76

        lines.append("📈 If invested in mutual funds (12% avg returns):\n")
        lines.append(f"   1 year:  ₹{with_returns_1y:,.0f}")
        lines.append(f"   3 years: ₹{with_returns_3y:,.0f}")
        lines.append(f"   5 years: ₹{with_returns_5y:,.0f}\n")
        lines.append("🎯 Small change, BIG impact over time!")
        lines.append("💡 Ask about \"goals\" to see where this money could take you!")
        return "\n".join(lines)

    # ---- SMART DEBT KILLER ----
    if intent == "debt_killer":
        lines = ["⚔️ Smart Debt Killer AI\n"]

        # Analyze any EMI/loan-like debits
        recurring_debits = {}
        for t in debits:
            key = (t.receiver or t.category or 'Unknown').lower()
            if any(word in key for word in ['emi', 'loan', 'repay', 'installment', 'credit card']):
                recurring_debits[key] = recurring_debits.get(key, 0) + t.amount

        if recurring_debits:
            total_debt = sum(recurring_debits.values())
            lines.append(f"📋 Detected Debt Payments:\n")
            for name, amt in sorted(recurring_debits.items(), key=lambda x: -x[1]):
                lines.append(f"   💳 {name.title()}: ₹{amt:,.0f}/month")
            lines.append(f"\n   Total monthly debt: ₹{total_debt:,}")
            debt_ratio = (total_debt / total_income * 100) if total_income > 0 else 0
            lines.append(f"   Debt-to-income ratio: {debt_ratio:.1f}%\n")

            if debt_ratio > 50:
                lines.append("🚨 CRITICAL: Debt is over 50% of income!")
            elif debt_ratio > 30:
                lines.append("⚠️ WARNING: Debt is high. Focus on reducing it.")
            else:
                lines.append("✅ Debt level is manageable.\n")
        else:
            lines.append("✅ No EMI/loan payments detected in your transactions.\n")

        lines.append("📖 Debt Repayment Strategies:\n")
        lines.append("1. 🔥 **Avalanche Method** (Recommended)")
        lines.append("   Pay minimum on all debts, put extra money on highest-interest debt first")
        lines.append("   ✅ Saves the most money in total interest\n")
        lines.append("2. ⛄ **Snowball Method**")
        lines.append("   Pay off smallest debt first for motivation, then roll that payment to next")
        lines.append("   ✅ Best for motivation and quick wins\n")
        lines.append("3. 🔄 **Consolidation**")
        lines.append("   Combine multiple debts into one lower-interest loan")
        lines.append("   ✅ Simplifies payments\n")

        # Debt-free projection
        surplus = max(0, total_income - total_spent)
        if surplus > 0 and recurring_debits:
            total_debt_est = sum(recurring_debits.values()) * 12
            months_to_free = int(total_debt_est / (surplus + sum(recurring_debits.values()))) if surplus > 0 else 999
            lines.append(f"🎯 With your surplus of ₹{surplus:,.0f}/month:")
            lines.append(f"   Estimated debt-free date: ~{months_to_free} months")
            lines.append(f"   If you add ₹{int(surplus * 0.5):,} extra/month: ~{int(months_to_free * 0.6)} months!\n")

        lines.append("💡 Rule: Keep total EMIs under 30% of income")
        lines.append(f"   Your target: max ₹{int(total_income * 0.3):,}/month in debt payments")
        return "\n".join(lines)

    # ---- AI SPENDING COACH (Behavior Correction) ----
    if intent == "spending_coach":
        lines = ["🏋️ AI Spending Coach — Behavior Analysis\n"]

        if not debits:
            lines.append("No spending data yet. Make some transactions and I'll analyze your habits!")
            return "\n".join(lines)

        categories = {}
        receivers = {}
        for t in debits:
            cat = (t.category or "General").lower()
            categories[cat] = categories.get(cat, 0) + t.amount
            recv = (t.receiver or "").lower()
            if recv:
                receivers[recv] = receivers.get(recv, 0) + t.amount

        sorted_cats = sorted(categories.items(), key=lambda x: -x[1])
        lines.append("🔍 Spending Habits Detected:\n")

        bad_habits = []
        # Food habit detection
        food_spend = categories.get("food", 0)
        food_txns = [t for t in debits if (t.category or "").lower() == "food"]
        if food_txns:
            avg_food_per_txn = food_spend / len(food_txns)
            food_pct = (food_spend / total_spent * 100) if total_spent > 0 else 0
            if food_pct > 30:
                bad_habits.append(f"🍔 **Food Overload**: You spend {food_pct:.0f}% on food (₹{food_spend:,.0f})")
                lines.append(f"  🍔 Food spending: ₹{food_spend:,.0f} ({food_pct:.0f}% of total)")
                lines.append(f"     Avg per order: ₹{avg_food_per_txn:,.0f} across {len(food_txns)} orders")
                save_20 = food_spend * 0.2
                lines.append(f"     💡 Reducing by 20% saves ₹{save_20:,.0f}/month\n")

        # Shopping habit detection
        shop_spend = categories.get("shopping", 0)
        shop_txns = [t for t in debits if (t.category or "").lower() == "shopping"]
        if shop_txns:
            shop_pct = (shop_spend / total_spent * 100) if total_spent > 0 else 0
            if shop_pct > 25:
                bad_habits.append(f"🛍️ **Shopping Spree**: {shop_pct:.0f}% on shopping (₹{shop_spend:,.0f})")
                lines.append(f"  🛍️ Shopping: ₹{shop_spend:,.0f} ({shop_pct:.0f}% of total)")
                lines.append(f"     {len(shop_txns)} transactions, avg ₹{shop_spend / len(shop_txns):,.0f}")
                lines.append(f"     💡 Try the 24-hour rule: Wait before impulse buys\n")

        # Entertainment habit
        ent_spend = categories.get("entertainment", 0)
        ent_pct = (ent_spend / total_spent * 100) if total_spent > 0 else 0
        if ent_pct > 15:
            bad_habits.append(f"🎮 **Entertainment**: {ent_pct:.0f}% (₹{ent_spend:,.0f})")
            lines.append(f"  🎮 Entertainment: ₹{ent_spend:,.0f} ({ent_pct:.0f}%)")
            lines.append(f"     💡 Set a weekly entertainment budget of ₹{int(ent_spend / 4):,}\n")

        # Frequent small transactions (swiggy/zomato pattern)
        frequent_receivers = {r: c for r, c in receivers.items() if c > total_spent * 0.05}
        for recv, amt in sorted(frequent_receivers.items(), key=lambda x: -x[1])[:3]:
            recv_txns = [t for t in debits if (t.receiver or "").lower() == recv]
            if len(recv_txns) >= 3:
                lines.append(f"  🔄 Frequent: {recv.title()} — {len(recv_txns)} times, total ₹{amt:,.0f}")

        lines.append("\n🎯 AI Action Plan:\n")
        if bad_habits:
            lines.append(f"Found {len(bad_habits)} area(s) to improve:\n")
            for i, h in enumerate(bad_habits, 1):
                lines.append(f"  {i}. {h}")
            potential_savings = sum(categories.get(c, 0) * 0.2 for c in ["food", "shopping", "entertainment"])
            lines.append(f"\n💰 Potential monthly savings: ₹{potential_savings:,.0f}")
            lines.append(f"💰 Potential annual savings: ₹{potential_savings * 12:,.0f}")
        else:
            lines.append("✅ Great job! No major bad spending habits detected.")
            lines.append("Keep maintaining your balanced spending pattern!")

        lines.append("\n📊 Ask 'show my spending' for detailed category breakdown")
        return "\n".join(lines)

    # ---- AI BUDGET GENERATOR ----
    if intent == "budget":
        lines = ["📋 AI Personalized Budget Generator\n"]

        if total_income == 0:
            lines.append("⚠️ No income detected. I'll estimate based on your spending.\n")
            estimated_income = max(total_spent * 1.3, 25000)
        else:
            estimated_income = total_income

        lines.append(f"📊 Based on your income: ₹{estimated_income:,.0f}/month\n")
        lines.append("━━━ 50/30/20 Smart Budget ━━━\n")

        needs = estimated_income * 0.5
        wants = estimated_income * 0.3
        savings = estimated_income * 0.2

        lines.append(f"🏠 **NEEDS (50%)**: ₹{needs:,.0f}")
        lines.append(f"   Rent/Housing:   ₹{needs * 0.5:,.0f}")
        lines.append(f"   Groceries:      ₹{needs * 0.2:,.0f}")
        lines.append(f"   Transport:      ₹{needs * 0.15:,.0f}")
        lines.append(f"   Bills/Utilities: ₹{needs * 0.15:,.0f}\n")

        lines.append(f"🎯 **WANTS (30%)**: ₹{wants:,.0f}")
        lines.append(f"   Dining Out:     ₹{wants * 0.3:,.0f}")
        lines.append(f"   Shopping:       ₹{wants * 0.25:,.0f}")
        lines.append(f"   Entertainment:  ₹{wants * 0.25:,.0f}")
        lines.append(f"   Subscriptions:  ₹{wants * 0.2:,.0f}\n")

        lines.append(f"💰 **SAVINGS (20%)**: ₹{savings:,.0f}")
        lines.append(f"   Emergency Fund: ₹{savings * 0.4:,.0f}")
        lines.append(f"   SIP/Mutual Fund:₹{savings * 0.4:,.0f}")
        lines.append(f"   FD/Gold:        ₹{savings * 0.2:,.0f}\n")

        # Compare with ACTUAL spending
        categories = {}
        for t in debits:
            cat = (t.category or "General").lower()
            categories[cat] = categories.get(cat, 0) + t.amount

        lines.append("━━━ Your Actual vs Budget ━━━\n")
        actual_needs = sum(categories.get(c, 0) for c in ["rent", "bills", "transport", "health", "education"])
        actual_wants = sum(categories.get(c, 0) for c in ["food", "shopping", "entertainment"])
        actual_savings_amt = max(0, estimated_income - total_spent)

        lines.append(f"  Needs:   Budget ₹{needs:,.0f} vs Actual ₹{actual_needs:,.0f} {'✅' if actual_needs <= needs else '⚠️ Over'}")
        lines.append(f"  Wants:   Budget ₹{wants:,.0f} vs Actual ₹{actual_wants:,.0f} {'✅' if actual_wants <= wants else '⚠️ Over'}")
        lines.append(f"  Savings: Budget ₹{savings:,.0f} vs Actual ₹{actual_savings_amt:,.0f} {'✅' if actual_savings_amt >= savings else '⚠️ Low'}\n")

        if total_spent > estimated_income:
            lines.append(f"🚨 You're overspending by ₹{total_spent - estimated_income:,.0f}!")
            lines.append("Immediate action: Cut wants category by 30%")
        elif actual_savings_amt < savings:
            lines.append(f"📈 Increase savings by ₹{savings - actual_savings_amt:,.0f} to hit target")
        else:
            lines.append("🌟 You're doing great! Keep following this budget!")

        return "\n".join(lines)

    # ---- AI SMART SAVINGS AUTOMATION ----
    if intent == "smart_savings":
        lines = ["🤖 AI Smart Savings Automation\n"]

        lines.append(f"📊 Your Financial Snapshot:")
        lines.append(f"   Balance: ₹{balance:,.0f}")
        lines.append(f"   Income: ₹{total_income:,.0f}")
        lines.append(f"   Spending: ₹{total_spent:,.0f}\n")

        surplus = max(0, total_income - total_spent)
        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0

        lines.append("━━━ Smart Auto-Save Rules ━━━\n")

        # Rule 1: Salary day auto-save
        salary_txns = [t for t in credits if t.amount >= 10000]
        if salary_txns:
            salary_amt = max(t.amount for t in salary_txns)
            auto_save_pct = 15 if savings_rate > 20 else 10
            lines.append(f"📌 **Rule 1: Salary Day Save**")
            lines.append(f"   When salary (₹{salary_amt:,.0f}) arrives → Auto-save {auto_save_pct}%")
            lines.append(f"   Amount: ₹{int(salary_amt * auto_save_pct / 100):,}/month\n")

        # Rule 2: Low spending day save
        lines.append(f"📌 **Rule 2: Low Spending Day Bonus**")
        avg_daily_spend = total_spent / max(len(debits), 1)
        lines.append(f"   Your avg spending: ₹{avg_daily_spend:,.0f}/transaction")
        lines.append(f"   On days you spend <₹{int(avg_daily_spend * 0.5):,} → Save the difference")
        lines.append(f"   Estimated extra: ₹{int(avg_daily_spend * 0.3 * 10):,}/month\n")

        # Rule 3: Round-up save
        total_roundup = sum((100 - (t.amount % 100)) for t in debits if t.amount % 100 > 0)
        lines.append(f"📌 **Rule 3: Round-Up Savings**")
        lines.append(f"   Every purchase rounded up to nearest ₹100")
        lines.append(f"   From recent txns: ₹{total_roundup:,} could be auto-saved\n")

        # Rule 4: Weekend savings
        lines.append(f"📌 **Rule 4: Weekend Savings Challenge**")
        lines.append(f"   Limit weekend spending to ₹{int(avg_daily_spend * 0.7):,}/day")
        lines.append(f"   Potential savings: ₹{int(avg_daily_spend * 0.3 * 8):,}/month\n")

        # Total projection
        total_auto_save = int(surplus * 0.15 + total_roundup * 2 + avg_daily_spend * 0.3 * 10)
        lines.append("━━━ Projected Auto-Savings ━━━\n")
        lines.append(f"   Monthly: ₹{total_auto_save:,}")
        lines.append(f"   6 months: ₹{total_auto_save * 6:,}")
        lines.append(f"   1 year: ₹{total_auto_save * 12:,}")
        lines.append(f"   With 12% returns: ₹{int(total_auto_save * 12 * 1.12):,}\n")
        lines.append("🎯 Small automated savings add up to BIG results!")
        lines.append("💡 Ask about 'budget' to create a personalized budget plan")
        return "\n".join(lines)

    # ---- AI ANOMALY DETECTION ----
    if intent == "anomaly":
        lines = ["🔒 AI Anomaly Detection — Security Scan\n"]

        if not transactions:
            lines.append("✅ No transactions to analyze. Your account looks safe!")
            return "\n".join(lines)

        anomalies = []

        # Check for large unusual transactions
        avg_debit = total_spent / max(len(debits), 1)
        for t in debits:
            if t.amount > avg_debit * 3:
                anomalies.append(f"🔴 **Large Transaction**: ₹{t.amount:,.0f} to {t.receiver or 'Unknown'} (3x+ your average)")

        # Check for blocked/failed transactions
        blocked = [t for t in transactions if t.status in ("blocked", "failed")]
        if blocked:
            anomalies.append(f"🟡 **Blocked/Failed**: {len(blocked)} transaction(s) were blocked or failed")

        # Check for unusual categories (new category with high spending)
        categories = {}
        for t in debits:
            cat = (t.category or "General")
            categories[cat] = categories.get(cat, 0) + t.amount
        avg_cat_spend = total_spent / max(len(categories), 1)
        for cat, amt in categories.items():
            if amt > avg_cat_spend * 2.5 and cat.lower() not in ["rent", "salary"]:
                anomalies.append(f"🟡 **Unusual Category Spike**: {cat} spending (₹{amt:,.0f}) is 2.5x+ average category spend")

        # Check for rapid transactions (multiple transactions close together)
        if len(debits) >= 5:
            recent_5 = debits[:5]
            total_recent = sum(t.amount for t in recent_5)
            if total_recent > total_spent * 0.5:
                anomalies.append(f"🟡 **Rapid Spending**: Last 5 transactions total ₹{total_recent:,.0f} (50%+ of all spending)")

        # Security score
        security_score = 100 - (len(anomalies) * 15)
        security_score = max(0, min(100, security_score))

        if security_score >= 80:
            status = "🟢 SECURE"
        elif security_score >= 50:
            status = "🟡 CAUTION"
        else:
            status = "🔴 AT RISK"

        lines.append(f"🛡️ Security Score: {security_score}/100 — {status}\n")

        if anomalies:
            lines.append(f"⚠️ Found {len(anomalies)} potential anomaly(ies):\n")
            for a in anomalies:
                lines.append(f"  {a}")
            lines.append("\n🤖 AI Recommendations:")
            lines.append("  • Review any unrecognized transactions above")
            lines.append("  • Enable transaction alerts for amounts >₹5000")
            lines.append("  • Report suspicious activity immediately")
        else:
            lines.append("✅ No anomalies detected!")
            lines.append("Your account activity looks normal and safe.\n")
            lines.append("🛡️ Security Tips:")
            lines.append("  • Never share OTP or PIN with anyone")
            lines.append("  • Check your transactions regularly")
            lines.append("  • Use strong passwords")

        return "\n".join(lines)

    # ---- AI CASH FLOW PROJECTION ----
    if intent == "cashflow":
        lines = ["📈 AI Predictive Cash Flow Analysis\n"]

        lines.append(f"📊 Current Position:")
        lines.append(f"   Balance: ₹{balance:,.0f}")
        lines.append(f"   Monthly Income: ₹{total_income:,.0f}")
        lines.append(f"   Monthly Expense: ₹{total_spent:,.0f}\n")

        monthly_net = total_income - total_spent
        daily_avg_spend = total_spent / max(len(debits), 1)

        lines.append("━━━ 7-Day Forecast ━━━")
        for day in range(1, 8):
            projected = balance - (daily_avg_spend * day)
            bar = "█" * max(1, int(projected / balance * 20)) if balance > 0 else ""
            status = "✅" if projected > balance * 0.3 else ("⚠️" if projected > 0 else "🚨")
            lines.append(f"   Day {day}: ₹{max(0, projected):,.0f} {bar} {status}")

        lines.append(f"\n━━━ 30-Day Projection ━━━")
        week1 = balance - (daily_avg_spend * 7)
        week2 = balance - (daily_avg_spend * 14)
        week3 = balance - (daily_avg_spend * 21)
        week4 = balance - (daily_avg_spend * 28) + total_income  # assume salary comes in
        lines.append(f"   Week 1: ₹{max(0, week1):,.0f}")
        lines.append(f"   Week 2: ₹{max(0, week2):,.0f}")
        lines.append(f"   Week 3: ₹{max(0, week3):,.0f}")
        lines.append(f"   Week 4: ₹{max(0, week4):,.0f} (salary expected)\n")

        if monthly_net > 0:
            lines.append(f"📈 Monthly surplus: ₹{monthly_net:,.0f}")
            lines.append(f"   3 months: ₹{balance + monthly_net * 3:,.0f}")
            lines.append(f"   6 months: ₹{balance + monthly_net * 6:,.0f}")
        else:
            days_left = int(balance / daily_avg_spend) if daily_avg_spend > 0 else 999
            lines.append(f"⚠️ Net negative: -₹{abs(monthly_net):,.0f}/month")
            lines.append(f"   Balance may hit ₹0 in ~{days_left} days")
            lines.append(f"   Action: Reduce spending by ₹{abs(monthly_net):,.0f} or increase income")

        lines.append("\n💡 Ask 'create budget' for personalized budget plan")
        return "\n".join(lines)

    # ---- MONEY TRANSFER VIA CHAT ----
    if intent == "transfer_money":
        parsed = parse_transfer_request(message)
        lines = ["💸 AI Money Transfer\n"]

        if parsed["missing_fields"]:
            # Need more info
            if len(parsed["missing_fields"]) == 4:
                # Fresh transfer request
                lines.append("I can help you transfer money via NEFT! I'll need:\n")
                lines.append("  1. 👤 Beneficiary Name")
                lines.append("  2. 📝 Account Number")
                lines.append("  3. 🔗 IFSC Code")
                lines.append("  4. 💰 Amount\n")
                lines.append("Please provide these details (you can send all at once).")
                lines.append("Example: \"Transfer ₹5,000 to Rahul Sharma, account 1234567890, IFSC SBIN0001234\"")
            else:
                # Some details provided, ask for rest
                if parsed.get("bank_info"):
                    bank = parsed["bank_info"]
                    lines.append(f"✅ IFSC {parsed['ifsc']} → **{bank['bank']}** (Branch: {bank.get('branch_code', 'N/A')})\n")
                if parsed.get("account_number"):
                    lines.append(f"✅ Account: {parsed['account_number']}")
                if parsed.get("amount"):
                    lines.append(f"✅ Amount: ₹{parsed['amount']:,.2f}")
                if parsed.get("beneficiary_name"):
                    lines.append(f"✅ Name: {parsed['beneficiary_name']}")
                lines.append(f"\n{format_transfer_prompt(parsed['missing_fields'])}")
        else:
            # All details available — show summary for confirmation
            lines = [format_transfer_summary(parsed, balance)]

        return "\n".join(lines)

    # ---- IFSC LOOKUP ----
    if intent == "ifsc_lookup":
        ifsc_match = re.search(r'([A-Z]{4}0[A-Z0-9]{6})', message.upper())
        if ifsc_match:
            ifsc = ifsc_match.group(1)
            info = get_ifsc_bank_info(ifsc)
            if info:
                lines = [f"🏦 IFSC Code Lookup: {ifsc}\n"]
                lines.append(f"  ✅ Valid IFSC Code")
                lines.append(f"  🏦 Bank: **{info['bank']}**")
                lines.append(f"  📝 Prefix: {info.get('prefix', ifsc[:4])}")
                lines.append(f"  🔗 Branch Code: {info.get('branch_code', ifsc[5:])}\n")
                lines.append("This IFSC can be used for NEFT, RTGS, and IMPS transfers.")
                lines.append("\n💡 Want to transfer money? Just say \"Transfer money\" and I'll guide you!")
                return "\n".join(lines)

        # General IFSC info
        lines = ["🔗 IFSC Code Information\n"]
        lines.append("IFSC (Indian Financial System Code) is an 11-character code to identify bank branches.\n")
        lines.append("Format: XXXX0YYYYYY")
        lines.append("  • First 4 chars = Bank name (e.g., SBIN = SBI, HDFC = HDFC Bank)")
        lines.append("  • 5th char = Always 0")
        lines.append("  • Last 6 chars = Branch code\n")
        lines.append("Common prefixes:")
        lines.append("  SBIN → State Bank of India")
        lines.append("  HDFC → HDFC Bank")
        lines.append("  ICIC → ICICI Bank")
        lines.append("  UTIB → Axis Bank")
        lines.append("  PUNB → Punjab National Bank")
        lines.append("  BARB → Bank of Baroda\n")
        lines.append("💡 Share an IFSC code and I'll tell you which bank and branch it belongs to!")
        return "\n".join(lines)

    # ---- AI INVESTMENT ADVISOR ----
    if intent == "investment_advisor":
        lines = ["📈 AI Investment Advisor\n"]

        lines.append(f"📊 Your Financial Position:")
        lines.append(f"   Balance: ₹{balance:,.0f}")
        lines.append(f"   Monthly Income: ₹{total_income:,.0f}")
        lines.append(f"   Monthly Expenses: ₹{total_spent:,.0f}")
        surplus = max(0, total_income - total_spent)
        lines.append(f"   Available to Invest: ₹{surplus:,.0f}/month\n")

        if surplus <= 0:
            lines.append("⚠️ You're spending more than you earn. Fix this first before investing.\n")
            lines.append("💡 Ask me: \"Create a budget\" or \"Coach my spending\"")
            return "\n".join(lines)

        # Determine risk profile
        savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
        if savings_rate >= 30 and balance >= 100000:
            risk = "Aggressive"
            emoji = "🔥"
        elif savings_rate >= 15 and balance >= 30000:
            risk = "Moderate"
            emoji = "⚡"
        else:
            risk = "Conservative"
            emoji = "🛡️"

        lines.append(f"{emoji} AI-Assessed Risk Profile: **{risk}**\n")
        lines.append("━━━ Recommended Portfolio ━━━\n")

        if risk == "Aggressive":
            lines.append(f"📈 **Equity Mutual Funds (SIP)**: ₹{int(surplus * 0.45):,}/month (45%)")
            lines.append(f"   → Nifty 50 Index Fund or Large Cap Fund")
            lines.append(f"   → Expected: 12-15% returns/year\n")
            lines.append(f"💎 **Mid/Small Cap Funds**: ₹{int(surplus * 0.20):,}/month (20%)")
            lines.append(f"   → Higher risk, higher reward")
            lines.append(f"   → Expected: 15-20% returns/year\n")
            lines.append(f"🥇 **Gold (Digital/SGB)**: ₹{int(surplus * 0.10):,}/month (10%)")
            lines.append(f"   → Hedge against market crashes\n")
            lines.append(f"🏦 **PPF/ELSS**: ₹{int(surplus * 0.15):,}/month (15%)")
            lines.append(f"   → Tax saving under Section 80C\n")
            lines.append(f"💵 **Emergency Fund**: ₹{int(surplus * 0.10):,}/month (10%)")
            lines.append(f"   → Liquid fund or savings account")
        elif risk == "Moderate":
            lines.append(f"📈 **Large Cap SIP**: ₹{int(surplus * 0.35):,}/month (35%)")
            lines.append(f"   → Stable companies, moderate returns")
            lines.append(f"   → Expected: 10-12% returns/year\n")
            lines.append(f"🏦 **Fixed Deposit**: ₹{int(surplus * 0.20):,}/month (20%)")
            lines.append(f"   → Safe, guaranteed 7-8% returns\n")
            lines.append(f"🥇 **Gold (SGB)**: ₹{int(surplus * 0.10):,}/month (10%)")
            lines.append(f"   → Sovereign Gold Bond for safety + returns\n")
            lines.append(f"📋 **PPF/ELSS**: ₹{int(surplus * 0.15):,}/month (15%)")
            lines.append(f"   → Tax saving + guaranteed returns\n")
            lines.append(f"💵 **Emergency Fund**: ₹{int(surplus * 0.20):,}/month (20%)")
            lines.append(f"   → Build 6 months of expenses first")
        else:
            lines.append(f"🏦 **Fixed Deposit**: ₹{int(surplus * 0.30):,}/month (30%)")
            lines.append(f"   → Safe, 7-8% guaranteed returns\n")
            lines.append(f"📋 **PPF**: ₹{int(surplus * 0.25):,}/month (25%)")
            lines.append(f"   → Government-backed, 7.1% tax-free\n")
            lines.append(f"📈 **Large Cap SIP**: ₹{int(surplus * 0.15):,}/month (15%)")
            lines.append(f"   → Low risk equity exposure\n")
            lines.append(f"💵 **Emergency Fund**: ₹{int(surplus * 0.30):,}/month (30%)")
            lines.append(f"   → Priority: build 6 months of expenses")

        # Growth projection
        annual_invest = surplus * 12
        lines.append(f"\n━━━ Growth Projection ━━━\n")
        lines.append(f"If you invest ₹{surplus:,}/month consistently:\n")
        lines.append(f"   1 year:  ₹{int(annual_invest * 1.10):,}")
        lines.append(f"   3 years: ₹{int(annual_invest * 3 * 1.36):,}")
        lines.append(f"   5 years: ₹{int(annual_invest * 5 * 1.76):,}")
        lines.append(f"   10 years: ₹{int(annual_invest * 10 * 3.10):,} 🚀\n")
        lines.append("⚠️ This is educational guidance, not financial advice. Consult a SEBI registered advisor.")
        return "\n".join(lines)

    # ---- TAX PLANNING ----
    if intent == "tax_planning":
        lines = ["🧾 AI Tax Planning Assistant\n"]

        lines.append(f"📊 Your Income: ₹{total_income:,.0f}/month (₹{total_income * 12:,.0f}/year)\n")

        annual_income = total_income * 12

        lines.append("━━━ Tax Saving Options (Section 80C — ₹1.5L limit) ━━━\n")
        lines.append("1. 📋 **PPF (Public Provident Fund)**")
        lines.append("   → ₹500 to ₹1,50,000/year | 7.1% returns | 15-year lock-in")
        lines.append("   → Completely tax-free! (EEE status)\n")
        lines.append("2. 📈 **ELSS Mutual Funds**")
        lines.append("   → Shortest lock-in: 3 years | 12-15% returns")
        lines.append("   → Best for market-linked tax saving\n")
        lines.append("3. 💰 **5-Year FD (Tax Saver)**")
        lines.append("   → Safe option | 7-8% returns | 5-year lock-in\n")
        lines.append("4. 🏥 **Life Insurance (Section 80C) + Health Insurance (80D)**")
        lines.append("   → 80D: Deduction up to ₹25,000 (₹50,000 for senior citizens)\n")
        lines.append("5. 🏠 **Home Loan Interest (Section 24)**")
        lines.append("   → Up to ₹2,00,000 deduction on interest\n")

        lines.append("━━━ AI Tax Strategy for You ━━━\n")

        monthly_surplus = max(0, total_income - total_spent)
        annual_surplus = monthly_surplus * 12

        if annual_income > 1000000:
            lines.append(f"💡 Income: ₹{annual_income:,.0f} — You're in 30% tax bracket")
            max_80c_save = min(150000, annual_surplus)
            tax_saved = int(max_80c_save * 0.312)
            lines.append(f"   Max 80C savings possible: ₹{max_80c_save:,}")
            lines.append(f"   Potential tax saving: ₹{tax_saved:,}/year\n")
            lines.append("   Recommended:")
            lines.append(f"   • ELSS SIP: ₹{min(12500, int(monthly_surplus * 0.3)):,}/month")
            lines.append(f"   • PPF: ₹{min(12500, int(monthly_surplus * 0.2)):,}/month")
            lines.append(f"   • NPS (50K extra under 80CCD): ₹{min(4166, int(monthly_surplus * 0.1)):,}/month")
        elif annual_income > 500000:
            lines.append(f"💡 Income: ₹{annual_income:,.0f} — You're in 20% tax bracket")
            max_80c_save = min(150000, annual_surplus)
            tax_saved = int(max_80c_save * 0.208)
            lines.append(f"   Potential tax saving: ₹{tax_saved:,}/year\n")
            lines.append("   Recommended:")
            lines.append(f"   • ELSS SIP: ₹{min(8000, int(monthly_surplus * 0.25)):,}/month")
            lines.append(f"   • PPF: ₹{min(5000, int(monthly_surplus * 0.15)):,}/month")
        else:
            lines.append(f"💡 Income: ₹{annual_income:,.0f} — Below ₹5L, minimal tax liability")
            lines.append("   Under new regime, you may not need tax-saving investments.")
            lines.append("   Focus on growth investments like SIPs instead.\n")

        lines.append("\n📅 Key Deadlines:")
        lines.append("   • Section 80C investments: Before March 31")
        lines.append("   • ITR filing: Before July 31")
        lines.append("   • Advance tax: Quarterly (Jun 15, Sep 15, Dec 15, Mar 15)\n")
        lines.append("⚠️ Consult a CA for personalized tax advice based on your full income details.")
        return "\n".join(lines)

    # ---- FINANCIAL QUIZ ----
    if intent == "finance_quiz":
        import random
        quiz_bank = [
            {
                "q": "What does NEFT stand for?",
                "options": ["A) National Electronic Fund Transfer", "B) New Electronic Fund Transfer", "C) National Exchange Fund Transfer", "D) None of these"],
                "answer": "A) National Electronic Fund Transfer",
                "fact": "NEFT works in half-hourly batches and has no minimum/maximum limit."
            },
            {
                "q": "What is the minimum CIBIL score for a home loan?",
                "options": ["A) 500", "B) 650", "C) 750", "D) 850"],
                "answer": "C) 750",
                "fact": "Most banks require 750+ for home loans, though some NBFCs accept 650+."
            },
            {
                "q": "Under Section 80C, maximum tax deduction is?",
                "options": ["A) ₹1,00,000", "B) ₹1,50,000", "C) ₹2,00,000", "D) ₹2,50,000"],
                "answer": "B) ₹1,50,000",
                "fact": "80C covers PPF, ELSS, life insurance, home loan principal, and more."
            },
            {
                "q": "What is the 50/30/20 budgeting rule?",
                "options": ["A) Save 50%, Spend 30%, Invest 20%", "B) Needs 50%, Wants 30%, Savings 20%", "C) Rent 50%, Food 30%, Fun 20%", "D) None of these"],
                "answer": "B) Needs 50%, Wants 30%, Savings 20%",
                "fact": "This popular rule helps balance spending and saving effectively."
            },
            {
                "q": "IFSC code has how many characters?",
                "options": ["A) 9", "B) 10", "C) 11", "D) 12"],
                "answer": "C) 11",
                "fact": "Format: XXXX0YYYYYY. First 4 = bank, 5th always 0, last 6 = branch."
            },
            {
                "q": "Which investment has highest liquidity?",
                "options": ["A) Fixed Deposit", "B) PPF", "C) Savings Account", "D) Real Estate"],
                "answer": "C) Savings Account",
                "fact": "Savings accounts let you withdraw anytime, while FDs have penalties."
            },
            {
                "q": "What does SIP stand for?",
                "options": ["A) Systematic Investment Plan", "B) Standard Investment Plan", "C) Savings Investment Plan", "D) Smart Investment Plan"],
                "answer": "A) Systematic Investment Plan",
                "fact": "SIPs let you invest small amounts regularly in mutual funds, using rupee-cost averaging."
            },
            {
                "q": "RBI's deposit insurance covers up to?",
                "options": ["A) ₹1 Lakh", "B) ₹3 Lakh", "C) ₹5 Lakh", "D) ₹10 Lakh"],
                "answer": "C) ₹5 Lakh",
                "fact": "DICGC insures up to ₹5 lakh per depositor per bank (raised from ₹1L in 2020)."
            },
        ]
        selected = random.sample(quiz_bank, min(3, len(quiz_bank)))

        lines = ["🧠 Financial Literacy Quiz!\n"]
        lines.append("Test your banking & finance knowledge:\n")

        for i, q in enumerate(selected, 1):
            lines.append(f"**Question {i}:** {q['q']}")
            for opt in q['options']:
                lines.append(f"   {opt}")
            lines.append("")

        lines.append("━━━ Answers ━━━\n")
        for i, q in enumerate(selected, 1):
            lines.append(f"Q{i}: ✅ {q['answer']}")
            lines.append(f"   💡 {q['fact']}\n")

        lines.append("📊 How'd you do? Ask for another quiz anytime!")
        lines.append(f"\n💰 Your current score potential: ₹{balance:,.0f} balance with {len(transactions)} transactions")
        lines.append("Knowledge + smart money habits = financial success! 🎯")
        return "\n".join(lines)

    # ---- BANKING KNOWLEDGE (RAG-enhanced) ----
    if intent == "knowledge_query":
        docs = retrieve(message, top_k=2)
        if docs:
            lines = [f"📚 Banking Knowledge\n"]
            for doc in docs:
                lines.append(f"━━━ {doc['topic']} ━━━\n")
                lines.append(doc["content"])
                lines.append("")
            lines.append("💡 Ask me more about any banking topic!")
            return "\n".join(lines)

    # ---- HINDI / MULTI-LANGUAGE SUPPORT ----
    if intent == "hindi":
        msg_lower = message.lower()
        lines = []

        if re.search(r'balance|paisa|kitna|jama', msg_lower):
            lines.append(f"🏦 Aapka Account Balance\n")
            lines.append(f"💰 Balance: ₹{balance:,.0f}")
            lines.append(f"📊 Total Kharch: ₹{total_spent:,.0f}")
            lines.append(f"💵 Total Jama: ₹{total_income:,.0f}\n")
            if balance > 20000:
                lines.append("✅ Aapka balance achha hai!")
            else:
                lines.append("⚠️ Balance kam ho raha hai. Kharch kam karein.")
        elif re.search(r'kharch|kharcha|spend', msg_lower):
            lines.append(f"📊 Aapka Kharch Analysis\n")
            lines.append(f"💸 Total kharch: ₹{total_spent:,.0f}")
            categories = {}
            for t in debits:
                cat = t.category or "General"
                categories[cat] = categories.get(cat, 0) + t.amount
            for cat, amt in sorted(categories.items(), key=lambda x: -x[1]):
                pct = (amt / total_spent * 100) if total_spent > 0 else 0
                lines.append(f"  {cat}: ₹{amt:,.0f} ({pct:.0f}%)")
            lines.append(f"\n💡 Tip: Zyada kharch food aur shopping pe na karein")
        elif re.search(r'bachat|sav', msg_lower):
            savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
            lines.append(f"💡 Bachat Tips\n")
            lines.append(f"📊 Aapki bachat: {savings_rate:.0f}%")
            lines.append(f"💰 Monthly bachat: ₹{max(0, total_income - total_spent):,.0f}\n")
            lines.append("🎯 Bachat badhane ke tips:")
            lines.append("  1. Income ka 20% turant save karein")
            lines.append("  2. Bahar ka khana kam karein")
            lines.append("  3. Unnecessary subscriptions band karein")
            lines.append("  4. Emergency fund banayein (3 month ka kharch)")
        elif re.search(r'loan|milega', msg_lower):
            lines.append(f"🏦 Loan Eligibility\n")
            lines.append(f"💰 Aapka balance: ₹{balance:,.0f}")
            lines.append(f"📝 Transactions: {len(transactions)}")
            if balance >= 20000 and len(transactions) >= 10:
                lines.append("\n✅ Aap loan ke liye eligible ho sakte hain!")
                lines.append("   Loan page pe jaake check karein.")
            else:
                lines.append("\n⚠️ Abhi loan mushkil hai. Balance badhayein.")
        else:
            lines.append(f"🤖 Namaste! Main aapka AI Banking Assistant hoon.\n")
            lines.append(f"💰 Aapka Balance: ₹{balance:,.0f}\n")
            lines.append("Main aapki madad kar sakta hoon:")
            lines.append("  • \"Mera balance kya hai?\" — Balance check")
            lines.append("  • \"Mera kharcha dikhao\" — Spending analysis")
            lines.append("  • \"Bachat tips batao\" — Saving tips")
            lines.append("  • \"Loan milega kya?\" — Loan eligibility")
            lines.append("\n💡 Aap Hindi ya English mein pooch sakte hain!")

        return "\n".join(lines)

    if intent == "thanks":
        return "You're welcome! 😊 Feel free to ask anything else about your finances."

    if intent == "farewell":
        return "Goodbye! 👋 Take care of your finances, and I'll be here whenever you need help."

    if intent == "help":
        return (
            "🤖 I'm your AI Banking Assistant! Here's everything I can do:\n\n"
            "💰 **Balance** — \"What's my balance?\" or \"Mera balance kya hai?\"\n"
            "📋 **Transactions** — \"Show my recent transactions\"\n"
            "📊 **Spending** — \"How much did I spend?\" or \"Spending on food\"\n"
            "💡 **Saving Tips** — \"Give me saving tips\"\n"
            "📊 **CIBIL Score** — \"What is my CIBIL score?\"\n"
            "📈 **Improve Score** — \"How to improve my CIBIL score?\"\n"
            "🏦 **Loans** — \"Am I eligible for a loan?\"\n"
            "📈 **Insights** — \"How am I doing financially?\"\n"
            "🔮 **Predictions** — \"Will I run low on balance?\"\n\n"
            "🆕 **AI-Powered Features:**\n"
            "💸 **Transfer Money** — \"Transfer ₹5000 to Rahul\" (AI-guided NEFT)\n"
            "🔗 **IFSC Lookup** — \"Check IFSC SBIN0001234\"\n"
            "📚 **Banking Knowledge** — \"What is NEFT?\" \"Explain mutual funds\"\n"
            "📈 **Investment Advisor** — \"Where should I invest?\"\n"
            "🧾 **Tax Planning** — \"How to save tax?\" \"Section 80C\"\n"
            "🧠 **Finance Quiz** — \"Quiz me\" \"Test my knowledge\"\n"
            "😊 **Mood Support** — \"I'm stressed about money\"\n"
            "🎯 **Goal Planning** — \"I want to save for a car\"\n"
            "📱 **Subscriptions** — \"Show my subscriptions\"\n"
            "🔮 **Digital Twin** — \"What if I cut spending by 10%?\"\n"
            "💎 **Micro-Invest** — \"Tell me about micro investment\"\n"
            "⚔️ **Debt Killer** — \"How to repay my debt?\"\n"
            "🏋️ **Spending Coach** — \"Analyze my spending habits\"\n"
            "📋 **Budget** — \"Create a budget for me\"\n"
            "🤖 **Auto Savings** — \"Setup automatic savings\"\n"
            "🔒 **Security Scan** — \"Is my account safe?\"\n"
            "📈 **Cash Flow** — \"Show my cash flow projection\"\n"
            "🇮🇳 **Hindi Support** — \"Mera balance kya hai?\"\n\n"
            "Just type naturally — I understand casual questions too!"
        )

    # Unknown intent — provide helpful response instead of generic message
    return (
        f"I'm not sure I understood that. Let me share what I know:\n\n"
        f"💰 Your balance: ₹{balance:,.0f}\n"
        f"💸 Recent spending: ₹{total_spent:,.0f} across {len(debits)} transactions\n"
        f"💵 Recent income: ₹{total_income:,.0f}\n\n"
        f"Try asking me:\n"
        f"• \"What's my balance?\"\n"
        f"• \"Show recent transactions\"\n"
        f"• \"How much did I spend?\"\n"
        f"• \"Give me saving tips\"\n"
        f"• \"Am I eligible for a loan?\"\n"
        f"• \"Predict my expenses\""
    )


def analyze_chat(message: str, balance: float, transactions: List[TransactionItem], chat_history=None) -> str:
    # Step 1: Sanitize input
    message = sanitize_message(message)
    if not message:
        return "Please type a message. I'm here to help with your banking needs!"

    # Step 2: Check guardrails
    guard_result = check_guardrails(message)
    if guard_result["blocked"]:
        return guard_result["reason"]

    context = _build_context(balance, transactions)

    # Step 3: Detect intent for special handling
    intent = _detect_intent(message)

    # Step 4: For transfer intent, check if we have ongoing transfer in history
    ongoing = bool(chat_history and _is_ongoing_transfer(chat_history))
    if intent == "transfer_money" or ongoing:
        # Override intent to transfer_money during ongoing transfer flow
        # This prevents IFSC lookup or other intents from hijacking the transfer conversation
        if chat_history and _is_ongoing_transfer(chat_history):
            parsed = parse_transfer_request(message, chat_history)
            if parsed["account_number"] or parsed["ifsc"] or parsed["amount"] or parsed["beneficiary_name"]:
                # Force intent to transfer_money so _smart_reply handles it correctly
                return _smart_reply_as_transfer(message, balance, transactions, chat_history)
        return _smart_reply(message, balance, transactions)

    # Step 5: RAG augmentation for knowledge queries
    rag_context = ""
    if intent in ("knowledge_query", "ifsc_lookup", "unknown"):
        docs = retrieve(message, top_k=2)
        if docs:
            rag_context = "\n\n--- BANKING KNOWLEDGE ---\n"
            for doc in docs:
                rag_context += f"[{doc['topic']}]: {doc['content']}\n"
            rag_context += "--- END KNOWLEDGE ---"

    # Build context memory summary from chat history
    memory_context = ""
    if chat_history:
        recent_topics = []
        for h in chat_history[-6:]:
            if h.role == "user":
                h_intent = _detect_intent(h.message)
                if h_intent not in ("greeting", "thanks", "farewell", "help", "unknown"):
                    recent_topics.append(h_intent)
        if recent_topics:
            memory_context = f"\n\nPrevious conversation topics: {', '.join(set(recent_topics))}"

    # Try OpenAI first if available
    if HAS_OPENAI and client:
        try:
            system = SYSTEM_PROMPT
            if rag_context:
                system += f"\n\nUse the following banking knowledge to answer accurately:{rag_context}"

            messages = [
                {"role": "system", "content": system},
            ]
            # Add chat history for context
            if chat_history:
                for h in chat_history[-6:]:
                    role = "user" if h.role == "user" else "assistant"
                    messages.append({"role": role, "content": h.message})
            messages.append({"role": "user", "content": f"--- USER FINANCIAL DATA ---\n{context}{memory_context}\n--- END DATA ---\n\nUser question: {message}"})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception:
            pass

    # Smart fallback with intent detection
    return _smart_reply(message, balance, transactions)


def _is_ongoing_transfer(chat_history) -> bool:
    """Check if there's an ongoing transfer conversation in recent history."""
    if not chat_history:
        return False
    for h in reversed(chat_history[-6:]):
        if h.role == "ai" and any(kw in h.message.lower() for kw in [
            "transfer summary", "beneficiary", "ifsc code", "account number",
            "transfer money", "need a few more details", "confirm",
        ]):
            return True
    return False


def _smart_reply_as_transfer(message: str, balance: float, transactions: List[TransactionItem], chat_history=None) -> str:
    """Handle ongoing transfer conversation — parse details from full history and show transfer state."""
    # Combine all chat history messages for parsing
    history_messages = []
    if chat_history:
        for h in chat_history[-10:]:
            history_messages.append(h.message)
    history_messages.append(message)
    full_text = " ".join(history_messages)

    parsed = parse_transfer_request(full_text)
    lines = ["💸 AI Money Transfer\n"]

    if parsed["missing_fields"]:
        if parsed.get("bank_info"):
            bank = parsed["bank_info"]
            lines.append(f"✅ IFSC {parsed['ifsc']} → **{bank['bank']}** (Branch: {bank.get('branch_code', 'N/A')})\n")
        if parsed.get("account_number"):
            lines.append(f"✅ Account: {parsed['account_number']}")
        if parsed.get("amount"):
            lines.append(f"✅ Amount: ₹{parsed['amount']:,.2f}")
        if parsed.get("beneficiary_name"):
            lines.append(f"✅ Name: {parsed['beneficiary_name']}")
        lines.append(f"\n{format_transfer_prompt(parsed['missing_fields'])}")
    else:
        lines = [format_transfer_summary(parsed, balance)]

    return "\n".join(lines)
