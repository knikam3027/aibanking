"""
AI Guardrails — Content moderation and word blocking for banking chat.
Blocks profanity, hate speech, harmful content, and prompt injection attempts.
"""

import re

# Blocked word categories
PROFANITY = {
    "fuck", "shit", "ass", "bitch", "damn", "bastard", "dick", "pussy",
    "asshole", "motherfucker", "crap", "piss", "slut", "whore",
    "madarchod", "bhenchod", "chutiya", "gaand", "lund", "randi",
    "bc", "mc", "bsdk", "gandu",
}

HATE_SPEECH = {
    "kill", "murder", "terrorist", "bomb", "attack", "shooting",
    "nigger", "nigga", "faggot", "retard",
}

FINANCIAL_ABUSE = {
    "hack", "steal money", "fraud scheme", "money laundering",
    "counterfeit", "phishing", "scam someone", "exploit",
}

PROMPT_INJECTION_PATTERNS = [
    r"ignore\s*(all\s*)?(previous|prior|above)\s*(instructions?|prompts?|rules?)",
    r"forget\s*(all\s*)?(your|the)\s*(instructions?|rules?|prompts?)",
    r"you\s*are\s*now\s*(a|an)\s*(different|new|evil)",
    r"system\s*prompt",
    r"reveal\s*(your|the)\s*(instructions?|prompt|system)",
    r"act\s*as\s*(if|though)\s*you\s*(have\s*)?no\s*rules",
    r"pretend\s*(you\s*)?(are|have)\s*no\s*(restrictions?|limits?|rules?)",
    r"jailbreak",
    r"dan\s*mode",
    r"override\s*(your|safety|security)",
]

BLOCKED_RESPONSE = "⚠️ I can't process that message. Please keep our conversation respectful and related to banking/finance. I'm here to help with your financial queries!"

INJECTION_RESPONSE = "🛡️ I detected an unusual request pattern. For security, I can only help with banking and financial queries. How can I assist you today?"


def check_guardrails(message: str) -> dict:
    """
    Check a message against guardrails.
    Returns: { blocked: bool, reason: str, category: str }
    """
    msg_lower = message.lower().strip()
    words = set(re.findall(r'\b\w+\b', msg_lower))

    # Check prompt injection attempts
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, msg_lower):
            return {
                "blocked": True,
                "reason": INJECTION_RESPONSE,
                "category": "prompt_injection",
            }

    # Check profanity (individual words)
    profanity_found = words & PROFANITY
    if profanity_found:
        return {
            "blocked": True,
            "reason": BLOCKED_RESPONSE,
            "category": "profanity",
        }

    # Check hate speech
    hate_found = words & HATE_SPEECH
    if hate_found:
        # Allow "kill" in financial context like "debt killer"
        financial_context = any(kw in msg_lower for kw in [
            "debt", "bill", "budget", "expense", "subscription",
        ])
        if not financial_context:
            return {
                "blocked": True,
                "reason": BLOCKED_RESPONSE,
                "category": "hate_speech",
            }

    # Check financial abuse phrases
    for phrase in FINANCIAL_ABUSE:
        if phrase in msg_lower:
            # Allow "fraud" in context of "fraud check" or "fraud detection"
            if "fraud" in phrase and any(kw in msg_lower for kw in [
                "detect", "check", "alert", "scan", "safe", "report",
            ]):
                continue
            return {
                "blocked": True,
                "reason": "⚠️ I can't help with that request. If you suspect fraudulent activity on your account, please use the 'Scan for anomalies' feature or contact our support team.",
                "category": "financial_abuse",
            }

    # Check message length (possible spam/abuse)
    if len(message) > 2000:
        return {
            "blocked": True,
            "reason": "⚠️ Your message is too long. Please keep it under 2000 characters.",
            "category": "spam",
        }

    return {"blocked": False, "reason": "", "category": ""}


def sanitize_message(message: str) -> str:
    """Sanitize user input — strip dangerous characters but keep meaningful content."""
    # Remove null bytes and control characters
    message = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', message)
    # Trim whitespace  
    message = message.strip()
    return message
