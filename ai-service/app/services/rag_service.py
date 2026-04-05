"""
RAG Pipeline — Retrieval-Augmented Generation for banking knowledge.
Uses a local knowledge base with TF-IDF based retrieval (no external vector DB needed).
Falls back to keyword matching if sklearn is not available.
"""

import re
import math
from collections import Counter

# ===== BANKING KNOWLEDGE BASE =====
KNOWLEDGE_BASE = [
    {
        "id": "ifsc_info",
        "topic": "IFSC Code",
        "content": "IFSC (Indian Financial System Code) is an 11-character alphanumeric code that uniquely identifies a bank branch in India. Format: First 4 characters represent the bank (e.g., SBIN for SBI, HDFC for HDFC Bank, ICIC for ICICI Bank, UTIB for Axis Bank, PUNB for PNB, BARB for Bank of Baroda, KKBK for Kotak, CNRB for Canara Bank, IOBA for IOB, UBIN for Union Bank). The 5th character is always 0. Last 6 characters identify the specific branch. IFSC is used for NEFT, RTGS, and IMPS transfers.",
        "keywords": ["ifsc", "bank code", "branch code", "neft", "rtgs", "imps", "bank transfer"]
    },
    {
        "id": "neft_info",
        "topic": "NEFT Transfer",
        "content": "NEFT (National Electronic Funds Transfer) is a nationwide payment system for transferring funds between banks in India. Operates in half-hourly batches from 8 AM to 7 PM on working days. Available 24x7 since December 2019. No minimum or maximum limit. Settlement time: Usually within 2 hours. Charges: Most banks offer free NEFT for savings accounts. Requires: Beneficiary name, account number, IFSC code, and transfer amount. UTR (Unique Transaction Reference) number is provided as proof of transfer.",
        "keywords": ["neft", "transfer", "fund transfer", "payment", "utr", "settlement"]
    },
    {
        "id": "rtgs_info",
        "topic": "RTGS Transfer",
        "content": "RTGS (Real Time Gross Settlement) is for high-value, real-time fund transfers. Minimum amount: ₹2,00,000. No maximum limit. Available 24x7 since December 2020. Settlement: Instant (real-time). Used for large payments like property, business transactions. Charges vary by bank. Requires same details as NEFT: beneficiary name, account number, IFSC code.",
        "keywords": ["rtgs", "real time", "high value", "instant transfer", "large payment"]
    },
    {
        "id": "imps_info",
        "topic": "IMPS Transfer",
        "content": "IMPS (Immediate Payment Service) provides instant interbank electronic fund transfer 24x7, including holidays. Limit: Up to ₹5,00,000 per transaction. Requires: Beneficiary mobile number and MMID, or account number and IFSC. Charges: ₹2.50 to ₹25 depending on amount. Best for: Urgent small to medium transfers.",
        "keywords": ["imps", "immediate", "instant", "24x7", "mobile transfer", "mmid"]
    },
    {
        "id": "upi_info",
        "topic": "UPI Payments",
        "content": "UPI (Unified Payments Interface) is a real-time payment system by NPCI. Limit: Up to ₹1,00,000 per transaction (₹2,00,000 for some banks). Free of charge. Works via UPI ID (e.g., name@upi). Available 24x7. Apps: Google Pay, PhonePe, Paytm, BHIM. Features: Send, receive, scan QR, bill payments, merchant payments. UPI PIN required for authorization.",
        "keywords": ["upi", "google pay", "phonepe", "paytm", "bhim", "qr code", "upi id", "upi pin"]
    },
    {
        "id": "savings_account",
        "topic": "Savings Account",
        "content": "A savings account is a basic banking product for individuals. Interest rate: 2.5% to 7% per annum depending on bank. Minimum balance: ₹500 to ₹10,000 (varies by bank, zero for Jan Dhan). Features: Debit card, online banking, mobile banking, cheque book. Withdrawals: Unlimited through ATM/online (some banks limit to 4-5 per month). Tax: Interest above ₹10,000/year is taxable (₹50,000 for senior citizens).",
        "keywords": ["savings", "account", "interest", "minimum balance", "debit card", "deposit"]
    },
    {
        "id": "fd_info",
        "topic": "Fixed Deposit",
        "content": "Fixed Deposit (FD) is a savings instrument with guaranteed returns. Tenure: 7 days to 10 years. Interest: 3% to 8% depending on tenure and bank. Premature withdrawal: Allowed with penalty (0.5-1% less interest). Tax: TDS deducted if interest exceeds ₹40,000/year. Tax-saving FD: 5-year lock-in, deduction under Section 80C (up to ₹1.5 lakh). Senior citizens get 0.25-0.50% extra interest.",
        "keywords": ["fd", "fixed deposit", "interest rate", "tenure", "tds", "tax saving", "80c"]
    },
    {
        "id": "loan_types",
        "topic": "Types of Loans",
        "content": "Common loan types in India: 1) Home Loan: 6.5-9% interest, up to 30 years, tax benefits on principal (80C) and interest (24b). 2) Personal Loan: 10-24% interest, 1-5 years, no collateral. 3) Car Loan: 7-12% interest, 1-7 years. 4) Education Loan: 8-15% interest, moratorium period, tax benefit under 80E. 5) Gold Loan: 7-15% interest, quick disbursal. 6) Business Loan: 11-20% interest. EMI = [P × r × (1+r)^n] / [(1+r)^n - 1].",
        "keywords": ["loan", "home loan", "personal loan", "car loan", "education loan", "emi", "interest rate", "gold loan"]
    },
    {
        "id": "credit_score",
        "topic": "Credit Score / CIBIL",
        "content": "CIBIL Score ranges from 300-900. 750+ is considered good. Factors: Payment history (35%), credit utilization (30%), credit age (15%), credit mix (10%), hard inquiries (10%). Ways to improve: Pay EMIs on time, keep credit utilization below 30%, don't close old cards, limit new credit applications, maintain diverse credit mix. Check free on CIBIL website once a year.",
        "keywords": ["cibil", "credit score", "credit report", "credit utilization", "payment history", "credit card"]
    },
    {
        "id": "tax_saving",
        "topic": "Tax Saving Options",
        "content": "Tax saving under Indian Income Tax: Section 80C (₹1.5L): PPF, ELSS, EPF, NSC, tax-saving FD, life insurance, home loan principal. Section 80D (₹25K-₹1L): Health insurance. Section 80E: Education loan interest (no limit). Section 24(b) (₹2L): Home loan interest. Section 80TTA (₹10K): Savings account interest. New vs Old tax regime: Choose based on deductions available.",
        "keywords": ["tax", "80c", "80d", "tax saving", "ppf", "elss", "epf", "nsc", "deduction", "income tax"]
    },
    {
        "id": "mutual_funds",
        "topic": "Mutual Funds",
        "content": "Mutual funds pool money from investors to invest in stocks, bonds, etc. Types: Equity (high risk, ~12-15% returns), Debt (low risk, ~6-8%), Hybrid (balanced), Index funds (track Nifty/Sensex). SIP (Systematic Investment Plan): Invest fixed amount monthly, rupee cost averaging. Minimum SIP: ₹100-₹500. ELSS: Tax-saving mutual fund (3-year lock-in). NAV: Net Asset Value, calculated daily.",
        "keywords": ["mutual fund", "sip", "equity", "debt fund", "elss", "nav", "index fund", "nifty", "sensex"]
    },
    {
        "id": "insurance_info",
        "topic": "Insurance",
        "content": "Types of insurance: 1) Life Insurance: Term plan (pure protection, cheapest), Endowment (savings + insurance), ULIP (market-linked). 2) Health Insurance: Individual, family floater, super top-up. Minimum sum assured: ₹5L recommended. 3) Motor Insurance: Third-party (mandatory), comprehensive. 4) Travel Insurance. Ideal coverage: Life = 10x annual income, Health = ₹10-20L for family.",
        "keywords": ["insurance", "term plan", "health insurance", "life insurance", "ulip", "premium", "claim"]
    },
    {
        "id": "digital_banking",
        "topic": "Digital Banking Safety",
        "content": "Digital banking safety tips: Never share OTP, CVV, or PIN with anyone. Banks never ask for these via call/SMS. Use strong passwords with mix of letters, numbers, symbols. Enable 2FA (two-factor authentication). Check for HTTPS in URL. Don't click links in SMS/email claiming to be from bank. Use official banking apps only. Set transaction limits. Enable SMS alerts. Check statements regularly. Report unauthorized transactions within 3 days for full refund.",
        "keywords": ["safety", "security", "otp", "cvv", "pin", "phishing", "2fa", "password", "cyber fraud"]
    },
    {
        "id": "rbi_rules",
        "topic": "RBI Rules & Regulations",
        "content": "Key RBI rules: Savings account interest: Calculated on daily closing balance. Free ATM transactions: 5 per month (own bank), 3 per month (other bank). Unauthorized transaction liability: Zero if reported within 3 days. NBFC lending rate cap: As per RBI guidelines. KYC: Mandatory for all accounts. Dormant account: No transactions for 2+ years. Account number portability: Not available (unlike mobile). Locker rules: Bank responsible for locker security.",
        "keywords": ["rbi", "regulation", "atm", "kyc", "dormant", "locker", "unauthorized", "liability"]
    },
    {
        "id": "bank_ifsc_directory",
        "topic": "Major Bank IFSC Prefixes",
        "content": "IFSC prefix directory: SBIN = State Bank of India, HDFC = HDFC Bank, ICIC = ICICI Bank, UTIB = Axis Bank, PUNB = Punjab National Bank, BARB = Bank of Baroda, KKBK = Kotak Mahindra Bank, CNRB = Canara Bank, IOBA = Indian Overseas Bank, UBIN = Union Bank of India, BKID = Bank of India, IDIB = Indian Bank, CBIN = Central Bank of India, YESB = Yes Bank, INDB = IndusInd Bank, FDRL = Federal Bank, KARB = Karnataka Bank, SIBL = South Indian Bank, RATN = RBL Bank, MAHB = Bank of Maharashtra, ALLA = Allahabad Bank (now Indian Bank), CORP = Corporation Bank (now Union Bank), SYNB = Syndicate Bank (now Canara Bank).",
        "keywords": ["ifsc", "sbin", "hdfc", "icic", "utib", "punb", "barb", "kkbk", "cnrb", "bank name", "bank code"]
    },
    {
        "id": "account_types",
        "topic": "Types of Bank Accounts",
        "content": "Bank account types: 1) Savings Account: For individuals, earns interest. 2) Current Account: For businesses, no interest, unlimited transactions. 3) Salary Account: Zero balance, linked to employer. 4) NRI Account: NRE (repatriable), NRO (non-repatriable), FCNR (foreign currency). 5) Jan Dhan Account: Zero balance, ₹10,000 overdraft, accident insurance. 6) Senior Citizen Account: Higher interest rates. 7) Minor Account: Operated by guardian until 18.",
        "keywords": ["account type", "savings", "current", "salary account", "nri", "jan dhan", "senior citizen"]
    },
    {
        "id": "investment_basics",
        "topic": "Investment Basics",
        "content": "Investment fundamentals: Risk vs Return — higher risk = higher potential return. Power of compounding: Start early, even small amounts grow significantly. Rule of 72: Divide 72 by interest rate to find doubling time (e.g., 12% = 6 years). Asset allocation by age: 100 minus age = equity %. Emergency fund first: 3-6 months of expenses. Diversify: Don't put all eggs in one basket. SIP over lump sum for equity. Review portfolio annually.",
        "keywords": ["investment", "compound", "risk", "return", "portfolio", "diversify", "rule of 72", "asset allocation"]
    },
]

# Build simple TF-IDF-like index
def _tokenize(text: str) -> list:
    return re.findall(r'\b[a-z0-9]+\b', text.lower())


def _build_idf():
    """Build inverse document frequency for the knowledge base."""
    doc_count = len(KNOWLEDGE_BASE)
    df = Counter()
    for doc in KNOWLEDGE_BASE:
        tokens = set(_tokenize(doc["content"] + " " + doc["topic"] + " " + " ".join(doc["keywords"])))
        for token in tokens:
            df[token] += 1
    idf = {}
    for token, freq in df.items():
        idf[token] = math.log(doc_count / (1 + freq))
    return idf


_IDF = _build_idf()


def retrieve(query: str, top_k: int = 3) -> list:
    """
    Retrieve the most relevant knowledge base entries for a query.
    Returns list of { topic, content, score }.
    """
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    query_tf = Counter(query_tokens)
    results = []

    for doc in KNOWLEDGE_BASE:
        doc_text = doc["content"] + " " + doc["topic"] + " " + " ".join(doc["keywords"])
        doc_tokens = _tokenize(doc_text)
        doc_tf = Counter(doc_tokens)

        # TF-IDF cosine similarity (simplified)
        score = 0.0
        for token, q_count in query_tf.items():
            if token in doc_tf:
                idf = _IDF.get(token, 0)
                score += (q_count * idf) * (doc_tf[token] * idf)

        # Boost for exact keyword matches
        for kw in doc["keywords"]:
            if kw.lower() in query.lower():
                score += 5.0

        # Boost for topic match
        if doc["topic"].lower() in query.lower():
            score += 10.0

        if score > 0:
            results.append({
                "topic": doc["topic"],
                "content": doc["content"],
                "score": score,
                "id": doc["id"],
            })

    results.sort(key=lambda x: -x["score"])
    return results[:top_k]


def get_ifsc_bank_info(ifsc: str) -> dict | None:
    """
    Look up bank name and branch info from IFSC code prefix.
    """
    ifsc = ifsc.upper().strip()
    if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', ifsc):
        return None

    prefix = ifsc[:4]
    bank_map = {
        "SBIN": "State Bank of India",
        "HDFC": "HDFC Bank",
        "ICIC": "ICICI Bank",
        "UTIB": "Axis Bank",
        "PUNB": "Punjab National Bank",
        "BARB": "Bank of Baroda",
        "KKBK": "Kotak Mahindra Bank",
        "CNRB": "Canara Bank",
        "IOBA": "Indian Overseas Bank",
        "UBIN": "Union Bank of India",
        "BKID": "Bank of India",
        "IDIB": "Indian Bank",
        "CBIN": "Central Bank of India",
        "YESB": "Yes Bank",
        "INDB": "IndusInd Bank",
        "FDRL": "Federal Bank",
        "KARB": "Karnataka Bank",
        "SIBL": "South Indian Bank",
        "RATN": "RBL Bank",
        "MAHB": "Bank of Maharashtra",
        "CORP": "Union Bank (formerly Corporation Bank)",
        "SYNB": "Canara Bank (formerly Syndicate Bank)",
        "ALLA": "Indian Bank (formerly Allahabad Bank)",
        "VIJB": "Bank of Baroda (formerly Vijaya Bank)",
        "IDFB": "IDFC First Bank",
        "AIRP": "Airtel Payments Bank",
        "PYTM": "Paytm Payments Bank",
        "JAKA": "J&K Bank",
        "LAVB": "DBS Bank (formerly Lakshmi Vilas Bank)",
    }

    bank_name = bank_map.get(prefix)
    if not bank_name:
        return {"valid": True, "bank": f"Unknown Bank (prefix: {prefix})", "ifsc": ifsc, "branch_code": ifsc[5:]}

    return {
        "valid": True,
        "bank": bank_name,
        "ifsc": ifsc,
        "prefix": prefix,
        "branch_code": ifsc[5:],
    }


def augment_with_knowledge(query: str, base_context: str = "") -> str:
    """
    Augment a chat context with relevant knowledge base information.
    Used to enhance AI responses with banking knowledge.
    """
    docs = retrieve(query, top_k=2)
    if not docs:
        return base_context

    knowledge = "\n\n--- BANKING KNOWLEDGE ---\n"
    for doc in docs:
        knowledge += f"\n[{doc['topic']}]: {doc['content']}\n"
    knowledge += "--- END KNOWLEDGE ---\n"

    return base_context + knowledge
