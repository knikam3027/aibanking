"""
AI Transfer Service — Handles intelligent money transfer via chat.
Parses transfer intent, validates IFSC, provides bank info, generates UTR.
"""

import re
import random
import time
from app.services.rag_service import get_ifsc_bank_info


def parse_transfer_request(message: str, chat_history: list = None) -> dict:
    """
    Parse a transfer request from chat message and/or conversation history.
    Returns extracted fields and what's still needed.
    """
    result = {
        "account_number": None,
        "ifsc": None,
        "amount": None,
        "beneficiary_name": None,
        "bank_info": None,
        "missing_fields": [],
        "is_transfer_intent": False,
        "is_confirmation": False,
    }

    msg_lower = message.lower().strip()

    # Detect transfer intent
    if re.search(r'\b(transfer|send|pay|bhej|paisa\s*bhej|money\s*send|wire|remit|neft|payment\s*kar)\b', msg_lower):
        result["is_transfer_intent"] = True

    # Detect confirmation
    if re.search(r'\b(yes|confirm|haan|ha|proceed|go\s*ahead|do\s*it|approved?|ok|okay|sure|kar\s*do|bhej\s*do)\b', msg_lower):
        result["is_confirmation"] = True

    # Also check chat history for ongoing transfer conversation
    all_text = message
    if chat_history:
        for h in chat_history[-8:]:
            all_text += " " + h.message

    # Extract account number (9-18 digits)
    acc_match = re.search(r'\b(\d{9,18})\b', all_text)
    if acc_match:
        result["account_number"] = acc_match.group(1)

    # Extract IFSC code
    ifsc_match = re.search(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', all_text.upper())
    if ifsc_match:
        ifsc = ifsc_match.group(1)
        result["ifsc"] = ifsc
        result["bank_info"] = get_ifsc_bank_info(ifsc)

    # Extract amount (various formats: ₹5000, Rs 5000, 5000 rupees, 5,000)
    amount_patterns = [
        r'(?:₹|rs\.?\s*|inr\s*|rupees?\s*)(\d[\d,]*(?:\.\d{1,2})?)',
        r'(\d[\d,]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|rupees?|inr)',
        r'(?:amount|transfer|send|pay)\s*(?:of\s*)?(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)',
    ]
    for pattern in amount_patterns:
        amt_match = re.search(pattern, all_text.lower().replace(',', ''))
        if amt_match:
            try:
                amount = float(amt_match.group(1).replace(',', ''))
                if amount >= 1:
                    result["amount"] = amount
                    break
            except ValueError:
                pass

    # If no specific pattern matched, look for standalone large numbers that could be amounts
    if result["amount"] is None:
        nums = re.findall(r'\b(\d{3,})\b', message)
        for n in nums:
            val = float(n)
            # Skip if it looks like an account number (too many digits)
            if val >= 100 and len(n) < 9:
                result["amount"] = val
                break

    # Extract beneficiary name (case-insensitive, supports single names)
    name_patterns = [
        r'(?:name|beneficiary|to|receiver)\s*(?:is|:|-|=)?\s*([A-Za-z][A-Za-z]+(?: [A-Za-z]+)*)',
        r'(?:send\s+to|pay\s+to|transfer\s+to)\s+([A-Za-z][A-Za-z]+(?: [A-Za-z]+)*)',
        # Single-word answers that look like names (after "Beneficiary Name" prompt)
        r'^\s*([A-Za-z][a-z]{2,}(?:\s+[A-Za-z][a-z]+)*)\s*$',
    ]
    skip_words = {"the", "my", "this", "his", "her", "yes", "no", "ok", "confirm", "cancel",
                  "transfer", "send", "money", "pay", "amount", "account", "please", "bank",
                  "neft", "imps", "upi", "check", "what", "how", "where"}
    for pattern in name_patterns:
        # Try on the latest message first (for single-word name replies)
        for text_to_try in [message, all_text]:
            name_match = re.search(pattern, text_to_try, re.IGNORECASE | re.MULTILINE)
            if name_match:
                name = name_match.group(1).strip()
                name_title = name.title()
                if len(name) >= 3 and name.lower() not in skip_words:
                    result["beneficiary_name"] = name_title
                    break
        if result["beneficiary_name"]:
            break

    # Determine missing fields
    if not result["account_number"]:
        result["missing_fields"].append("account_number")
    if not result["ifsc"]:
        result["missing_fields"].append("ifsc")
    if not result["amount"]:
        result["missing_fields"].append("amount")
    if not result["beneficiary_name"]:
        result["missing_fields"].append("beneficiary_name")

    return result


def generate_utr(ifsc_prefix: str = "NEFT") -> str:
    """Generate a realistic UTR number."""
    prefix = ifsc_prefix[:4] if ifsc_prefix else "NEFT"
    timestamp = str(int(time.time()))
    random_part = str(random.randint(100000, 999999))
    return f"{prefix}N{timestamp}{random_part}"


def format_transfer_prompt(missing_fields: list) -> str:
    """Generate a prompt asking for missing transfer details."""
    field_names = {
        "account_number": "Account Number (9-18 digits)",
        "ifsc": "IFSC Code (e.g., SBIN0001234)",
        "amount": "Amount (₹)",
        "beneficiary_name": "Beneficiary Name",
    }

    lines = ["I need a few more details to process your transfer:\n"]
    for i, field in enumerate(missing_fields, 1):
        lines.append(f"  {i}. {field_names.get(field, field)}")
    lines.append("\nPlease provide the above details.")
    return "\n".join(lines)


def format_transfer_summary(parsed: dict, balance: float = 0) -> str:
    """Format transfer details for review before confirmation."""
    lines = ["💸 **Transfer Summary — Please Review**\n"]
    lines.append(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    lines.append(f"  👤 Beneficiary: {parsed['beneficiary_name']}")
    lines.append(f"  🏦 Bank: {parsed['bank_info']['bank'] if parsed.get('bank_info') else 'N/A'}")
    lines.append(f"  📝 Account: {parsed['account_number']}")
    lines.append(f"  🔗 IFSC: {parsed['ifsc']}")
    lines.append(f"  💰 Amount: ₹{parsed['amount']:,.2f}")
    lines.append(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    if balance > 0:
        lines.append(f"  Your Balance: ₹{balance:,.2f}")
        remaining = balance - parsed['amount']
        lines.append(f"  After Transfer: ₹{remaining:,.2f}")
        if remaining < 1000:
            lines.append(f"\n  ⚠️ Low balance warning after this transfer!")
        lines.append("")

    lines.append("Type **'confirm'** to proceed or **'cancel'** to abort.")
    return "\n".join(lines)


def format_transfer_success(utr: str, parsed: dict, new_balance: float) -> str:
    """Format successful transfer confirmation."""
    lines = ["✅ **Transfer Successful!**\n"]
    lines.append(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    lines.append(f"  🎫 UTR Number: **{utr}**")
    lines.append(f"  👤 To: {parsed['beneficiary_name']}")
    lines.append(f"  🏦 Bank: {parsed['bank_info']['bank'] if parsed.get('bank_info') else 'N/A'}")
    lines.append(f"  📝 Account: {parsed['account_number']}")
    lines.append(f"  💰 Amount: ₹{parsed['amount']:,.2f}")
    lines.append(f"  📅 Mode: NEFT")
    lines.append(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    lines.append(f"  💰 New Balance: ₹{new_balance:,.2f}")
    lines.append(f"\n📌 Save your UTR number for reference.")
    lines.append(f"⏰ NEFT settlement: Usually within 2 hours.")
    return "\n".join(lines)
