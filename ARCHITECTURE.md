# AI Banking Platform — Architecture & Documentation

---

## Problem Statement

Traditional banking systems face critical challenges in the modern digital era:

- **Fraud Vulnerability**: Conventional banking relies on static rule-based fraud detection that fails to catch sophisticated, evolving attack patterns. Users lose money before suspicious activity is even flagged.
- **Reactive Security**: Most banks only act *after* fraud has occurred — there is no real-time, intelligent layer that assesses risk *before* a transaction is processed.
- **No Voice Verification**: High-value transfers proceed without any human verification step, making them vulnerable to unauthorized access even when credentials are compromised.
- **Lack of Financial Intelligence**: Users have no access to personalized AI-driven insights about their spending behavior, financial health, or predictions about their future cash flow.
- **Manual & Error-Prone Payroll**: Organizations still process employee salaries through spreadsheets and manual verification — a slow, risky process prone to errors and fraud.
- **Poor Customer Support**: Traditional banking support is slow, generic, and unavailable outside business hours. Users cannot get instant, intelligent answers to banking queries.
- **No Proactive Alerts**: Users are not warned about unusual spending, low balances, or suspicious patterns until it's too late.

---

## Solution

An **AI-Powered Intelligent Banking Platform** that combines modern web technologies with artificial intelligence, voice verification, and real-time analytics to deliver a secure, smart, and proactive banking experience.

### Core Approach

1. **AI-First Security** — Every transaction passes through an AI fraud detection engine that scores risk in real-time (0–100) based on balance depletion, spending spikes, rapid-fire patterns, and transfer amount analysis. Suspicious transactions are blocked *before* they execute.

2. **Multi-Layer Voice Verification** — High-risk or high-value transfers trigger automated voice calls via **Exotel IVR** (pre-transfer) or **AWS Connect** (post-transfer for >₹1 Lakh). Users confirm via keypress — if they report fraud, the account is instantly frozen.

3. **Intelligent Financial Advisor** — An AI chat assistant powered by **OpenAI GPT-4o-mini** understands 40+ banking intents, answers financial queries in English and Hindi, performs transfers via natural language, and provides contextual suggestions.

4. **Predictive Analytics** — AI-driven cash flow projections, financial health scoring, balance predictions, and spending breakdowns give users foresight — not just hindsight.

5. **Smart Alert Engine** — Six types of proactive alerts (salary detection, unusual spending, low balance, subscription patterns, spending habits, financial health) notify users before problems arise.

6. **Automated Payroll Pipeline** — AI parses salary PDFs, extracts employee data, verifies accounts, and processes NEFT payments in a 4-step automated wizard.

7. **Admin Command Center** — Real-time dashboards, held account management, transaction reversal capabilities, and bulk balance operations give administrators full control.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER / ADMIN BROWSER                          │
│                                                                         │
│   React 19 + Vite + Tailwind CSS v4        (Port 5173)                 │
│   ┌──────────┬──────────┬──────────┬──────────┬──────────┐             │
│   │Dashboard │ Transfer │ AI Chat  │  Loans   │ Insights │             │
│   │          │ (2 modes)│ (40+     │          │ & Alerts │             │
│   │          │          │  intents)│          │          │             │
│   └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘             │
│        │          │          │          │          │                     │
│   ┌──────────┬──────────┬──────────┬──────────┐                        │
│   │  Admin   │  Admin   │  Admin   │  Admin   │                        │
│   │Dashboard │  Users   │ Payroll  │  Held    │                        │
│   │ (Charts) │(Bulk Ops)│(4-Step)  │ Accounts │                        │
│   └────┬─────┴────┬─────┴────┬─────┴────┬─────┘                        │
└────────┼──────────┼──────────┼──────────┼──────────────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NODE.JS / EXPRESS BACKEND                           │
│                          (Port 5000)                                    │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │    Auth      │  │  Transfer   │  │   AI Chat    │  │   Admin     │  │
│  │  (JWT +      │  │  Engine     │  │   Relay      │  │  Operations │  │
│  │   Bcrypt)    │  │             │  │              │  │             │  │
│  └──────────────┘  └──────┬──────┘  └──────┬───────┘  └─────────────┘  │
│                           │                │                            │
│  ┌─────────────┐  ┌──────▼──────┐  ┌──────▼───────┐  ┌─────────────┐  │
│  │   Loans     │  │   Fraud     │  │   Insights   │  │  Payroll    │  │
│  │  Eligibility│  │  Detection  │  │  & Alerts    │  │  Processor  │  │
│  └─────────────┘  └──────┬──────┘  └──────────────┘  └─────────────┘  │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐  │
│  │                  SECURITY LAYER                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │ Risk Score   │  │  Account     │  │  Post-Transfer         │  │  │
│  │  │ Assessment   │  │  Hold/Freeze │  │  Verification          │  │  │
│  │  │ (0-100)      │  │  System      │  │  Manager               │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────┬──────────┬──────────┬──────────┬──────────────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
┌──────────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
│  Python      │ │MongoDB │ │ Exotel  │ │ AWS Connect  │
│  FastAPI     │ │ Atlas  │ │  IVR    │ │  Voice       │
│  AI Service  │ │        │ │         │ │  Verification│
│  (Port 8001) │ │        │ │         │ │              │
└──────────────┘ └────────┘ └─────────┘ └──────────────┘
```

---

## Detailed Architecture Flows

### Flow 1: Normal Instant Transfer

```
User enters transfer details
        │
        ▼
Backend receives request
        │
        ▼
AI Fraud Detection Engine analyzes:
  • Balance depletion ratio
  • Spending spike detection
  • Rapid-fire transfer check
  • Large transfer flag
        │
        ▼
Risk Score generated (0–100)
        │
        ├── Score < 50 (LOW RISK) ──────► Transfer executes instantly
        │                                  Balances updated
        │                                  Transaction logged
        │
        ├── Score 50–75 (MEDIUM RISK) ──► Transfer executes with warning
        │                                  Alert generated for user
        │
        └── Score > 75 (HIGH RISK) ─────► Transfer BLOCKED
                                           Fraud alert created
                                           User notified
```

### Flow 2: Voice-Verified Transfer (Exotel)

```
User selects "Voice Verified" mode
        │
        ▼
Backend creates pending transfer
        │
        ▼
AI Risk Assessment runs (HIGH / MEDIUM / LOW)
        │
        ▼
Exotel IVR call triggered to user's phone
  • ExoPhone: 02048563766
  • Automated voice prompt plays
        │
        ▼
User presses keypad:
        │
        ├── Press 1 (CONFIRM) ──► Transfer executes
        │                          Status → completed
        │
        └── Press 2 (REJECT) ───► Transfer cancelled
                                   Status → rejected
                                   User alerted
```

### Flow 3: Post-Transfer Verification (AWS Connect)

```
Transfer amount > ₹1,00,000 detected
        │
        ▼
Transfer executes immediately
        │
        ▼
Verification record created (status: pending)
        │
        ▼
AWS Connect outbound call to user
  • "Did you authorize this transfer of ₹X to Y?"
        │
        ▼
User responds:
        │
        ├── Press 1 (LEGITIMATE) ──► Verification → confirmed
        │                             Transfer stays
        │
        └── Press 2 (SUSPICIOUS) ──► Account FROZEN immediately
                                      accountHeld = true
                                      All transfers blocked
                                      Admin notified
                                              │
                                              ▼
                                      Admin reviews:
                                        ├── Clear & Unhold → Account released
                                        └── Reverse & Unhold → Money returned
                                                               Account released
```

### Flow 4: AI Chat Assistant

```
User sends message
        │
        ▼
Backend relays to Python AI Service
        │
        ▼
Intent Detection (40+ patterns via regex):
  • Balance inquiry      • Transfer request
  • Spending analysis    • Loan eligibility
  • Budget advice        • Investment tips
  • Fraud reporting      • Account help
  • Hindi language       • Financial planning
  • Greeting/farewell    • ... and 30+ more
        │
        ▼
OpenAI GPT-4o-mini generates contextual response
  • Uses user's actual transaction data
  • Aware of account balance
  • Provides personalized advice
        │
        ▼
Response returned with:
  • AI message
  • Detected intent
  • Suggested follow-up questions
```

### Flow 5: Smart Alerts Engine

```
User requests alert generation
        │
        ▼
System analyzes last 30 days of transactions
        │
        ▼
Six alert types evaluated:
        │
        ├── 💰 Salary Detection
        │     Large credit (>50% of avg) → "Salary received!"
        │
        ├── ⚠️ Unusual Spending
        │     Daily spend > 3x average → "Unusual spending detected"
        │
        ├── 📉 Low Balance Warning
        │     Balance < 10% of monthly spend → "Balance critically low"
        │
        ├── 🔄 Subscription Alert
        │     Recurring similar amounts → "Possible subscription detected"
        │
        ├── 📊 Spending Pattern
        │     Category analysis → "You spend most on [category]"
        │
        └── 🏥 Financial Health
              Health score calculation → "Your financial health is [X]"
        │
        ▼
Alerts created with severity (info / warning / critical)
Daily limit: 5 alerts per user
```

### Flow 6: Payroll Processing Pipeline

```
Admin uploads salary PDF
        │
        ▼
STEP 1 — AI PDF Parsing (Python FastAPI)
  • Extracts employee names, account numbers, amounts
  • Returns structured employee list
        │
        ▼
STEP 2 — Account Verification
  • Each employee account checked against database
  • Status: verified / failed
  • Verification notes generated
        │
        ▼
STEP 3 — Review & Approval
  • Admin sees: verified count, failed count, total amount
  • System checks admin balance sufficiency
  • Admin approves payment
        │
        ▼
STEP 4 — NEFT Payment Execution
  • Funds debited from admin/bank account
  • Individual credits to each verified employee
  • Transaction records created
  • Results: paid count, failed count, details
```

### Flow 7: Loan Eligibility

```
User requests loan check
        │
        ▼
AI Credit Scoring Engine evaluates:
  • Account balance & history
  • Transaction patterns
  • Income regularity
  • Spending behavior
        │
        ▼
Credit Score generated (300–900)
        │
        ▼
Results returned:
  • Eligible: Yes/No
  • Maximum loan amount
  • Suggested interest rate
  • Risk category
        │
        ▼
If eligible → User can apply
  • Loan record created
  • Status: pending → approved/rejected (by admin)
```

---

## All Features

### Core Banking Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **User Registration & Login** | JWT-based authentication with bcrypt password hashing. Auto-generates unique 12-digit account numbers. Role-based access (user/admin). |
| 2 | **Account Dashboard** | Real-time balance display, recent transactions, quick stats (total in/out/transactions), AI-powered balance prediction. |
| 3 | **Instant Transfer** | Immediate fund transfer between accounts with AI fraud screening on every transaction. |
| 4 | **Voice-Verified Transfer** | Exotel IVR call-based verification before executing transfers. Three-tier risk assessment (high/medium/low). |
| 5 | **Post-Transfer Verification** | AWS Connect voice call for transfers exceeding ₹1 Lakh. Suspicious response triggers instant account freeze. |
| 6 | **Transaction History** | Paginated transaction list (20/page) with credit/debit filters, status badges, and category tracking. |
| 7 | **Loan Application** | AI-driven loan eligibility check with credit scoring, followed by application submission and admin approval workflow. |

### AI-Powered Features

| # | Feature | Description |
|---|---------|-------------|
| 8 | **AI Fraud Detection** | Real-time risk scoring (0–100) analyzing balance depletion ratio, spending spikes, rapid-fire patterns, and large transfer flags. Blocks high-risk transactions. |
| 9 | **AI Chat Assistant** | 40+ intent recognition via regex patterns + OpenAI GPT-4o-mini. Handles balance queries, transfer requests, spending analysis, budget advice, investment tips, fraud reporting, and more — in English and Hindi. |
| 10 | **Financial Insights** | AI-generated financial health score, spending category breakdown, income vs expense analysis, and personalized recommendations. |
| 11 | **Cash Flow Projection** | 30-day forward projection of cash flow based on historical spending patterns. Warns if balance may hit zero. |
| 12 | **Balance Prediction** | Weekly balance trend prediction with "days until low balance" estimate displayed on dashboard. |
| 13 | **Smart Alerts (6 Types)** | Salary detection, unusual spending warnings, low balance alerts, subscription detection, spending pattern analysis, financial health scoring — all generated from transaction analysis. |
| 14 | **AI Loan Scoring** | Credit score calculation (300–900) based on account behavior, with fallback algorithm if AI service is unavailable. |
| 15 | **AI Salary PDF Parsing** | Extracts employee names, account numbers, IFSC codes, and salary amounts from uploaded PDF documents using AI. |

### Security Features

| # | Feature | Description |
|---|---------|-------------|
| 16 | **Multi-Layer Fraud Prevention** | AI risk scoring → Voice verification (Exotel) → Post-transfer verification (AWS Connect) — three layers of protection. |
| 17 | **Account Hold/Freeze System** | Accounts flagged as suspicious are instantly frozen. All transfers blocked until admin review. |
| 18 | **Transaction Reversal** | Admin can reverse fraudulent transactions — funds returned to sender, receiver debited. Full audit trail maintained. |
| 19 | **JWT Authentication** | 7-day token expiry, protected routes, automatic redirect on token expiry. No passwords stored in client. |
| 20 | **Bcrypt Password Hashing** | 12-round salt hashing for all stored passwords. |

### Admin Features

| # | Feature | Description |
|---|---------|-------------|
| 21 | **Admin Dashboard** | Real-time metrics: bank reserve, total users, active today, total transactions, money in system, fraud alerts. Weekly charts for transaction volume and user registrations. Top users ranking. |
| 22 | **User Management** | Search by name/email/account number. Single or bulk balance operations. Bank balance tracking. |
| 23 | **Held Account Management** | View all frozen accounts with hold reasons, flagged transaction details. Two actions: Clear & Unhold or Reverse Transaction & Unhold. Admin notes support. |
| 24 | **Payroll Processing** | 4-step wizard: PDF Upload → AI Parsing → Account Verification → NEFT Payment. Batch processing with history tracking. |

### Integration Layer

| # | Feature | Description |
|---|---------|-------------|
| 25 | **Exotel IVR** | Outbound voice calls for transfer verification. ExoPhone 02048563766 with keypad response handling. Singapore region API. |
| 26 | **AWS Connect** | Post-transfer outbound calls for high-value verification. Account freeze on suspicious response. Auto-setup script for Connect instance configuration. |
| 27 | **OpenAI GPT-4o-mini** | Powers chat assistant, fraud analysis reasoning, financial insights generation, loan scoring, and salary PDF parsing. |
| 28 | **MongoDB Atlas** | Cloud database with 10+ data models: User, Transaction, Loan, Alert, ChatMessage, PostTransferVerification, VoiceVerifiedTransfer, PayrollBatch, and more. |

---

## Technology Stack

```
┌───────────────────────────────────────────────────┐
│                   FRONTEND                         │
│  React 19  •  Vite 8  •  Tailwind CSS v4          │
│  Recharts (Charts)  •  React Router DOM            │
└───────────────────────┬───────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────┐
│                   BACKEND                          │
│  Node.js  •  Express 5  •  Mongoose 9             │
│  JWT  •  Bcrypt  •  Multer (File Upload)           │
└────────┬──────────┬──────────┬────────────────────┘
         │          │          │
┌────────▼───┐ ┌────▼────┐ ┌──▼──────────────────┐
│  AI Engine │ │  Cloud  │ │  Voice Services     │
│  Python    │ │MongoDB  │ │  Exotel IVR         │
│  FastAPI   │ │ Atlas   │ │  AWS Connect        │
│  OpenAI    │ │         │ │                     │
└────────────┘ └─────────┘ └─────────────────────┘
```

---

## How It All Connects

1. **User opens the app** → React frontend served via Vite on port 5173
2. **User logs in** → JWT token issued by Express backend on port 5000
3. **User initiates transfer** → Backend runs AI fraud check via Python AI service on port 8001
4. **If voice-verified mode** → Exotel IVR call verifies user identity before execution
5. **If amount > ₹1 Lakh** → AWS Connect calls after transfer for post-verification
6. **If suspicious** → Account frozen, admin notified, transaction reversible
7. **User asks a question** → Chat relayed to AI service → OpenAI generates contextual response
8. **User checks insights** → AI analyzes transaction history → Returns health score, projections, alerts
9. **Admin processes payroll** → PDF uploaded → AI parses → Accounts verified → NEFT executed
10. **Everything persists** → MongoDB Atlas stores all data across 10+ collections

---

## AI Service — Deep Architecture (Python FastAPI Microservice)

The AI engine is a standalone **Python FastAPI microservice** running on Port 8001, responsible for all intelligence in the platform. It contains 9 specialized service modules, a guardrails safety layer, a RAG knowledge retrieval system, and multiple scoring algorithms.

### AI Service Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PYTHON FASTAPI AI MICROSERVICE (Port 8001)               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          FastAPI Router Layer                         │  │
│  │  /chat  •  /fraud-check  •  /insights  •  /loan-score               │  │
│  │  /predict-expense  •  /parse-salary-pdf                              │  │
│  └──────┬────────┬──────────┬──────────┬──────────┬──────────┬──────────┘  │
│         │        │          │          │          │          │              │
│         ▼        ▼          ▼          ▼          ▼          ▼              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     SERVICE LAYER (9 Modules)                      │    │
│  │                                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────┐     │    │
│  │  │           chat_service.py (1,650+ lines)                  │     │    │
│  │  │   • 40+ Intent Detection (regex NLU)                      │     │    │
│  │  │   • OpenAI GPT-4o-mini Integration                        │     │    │
│  │  │   • Smart Reply Fallback Engine                           │     │    │
│  │  │   • Financial Context Builder                             │     │    │
│  │  │   • CIBIL Score Calculator (700–900)                      │     │    │
│  │  │   • Digital Twin / Spending Coach / Debt Killer           │     │    │
│  │  │   • Hindi Language Support                                │     │    │
│  │  └──────────┬───────────────────────┬────────────────────────┘     │    │
│  │             │                       │                              │    │
│  │             ▼                       ▼                              │    │
│  │  ┌──────────────────┐   ┌───────────────────────┐                 │    │
│  │  │  guardrails.py   │   │   rag_service.py      │                 │    │
│  │  │  Safety Layer     │   │   Knowledge Retrieval │                 │    │
│  │  │  (5 categories)   │   │   (TF-IDF + 16 topics)│                │    │
│  │  └──────────────────┘   └───────────────────────┘                 │    │
│  │                                                                    │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │    │
│  │  │fraud_service │ │insights_     │ │loan_service  │              │    │
│  │  │  .py         │ │ service.py   │ │  .py         │              │    │
│  │  │ Risk Scoring │ │ Health Score │ │ Credit Score │              │    │
│  │  │  (0–100)     │ │  (0–100)     │ │  (0–100)     │              │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘              │    │
│  │                                                                    │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │    │
│  │  │prediction_   │ │pdf_service   │ │transfer_     │              │    │
│  │  │ service.py   │ │  .py         │ │ service.py   │              │    │
│  │  │ Cash Flow    │ │ Salary PDF   │ │ NEFT Transfer│              │    │
│  │  │ Forecasting  │ │ AI Parsing   │ │ State Machine│              │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     SCHEMA LAYER (Pydantic Models)                    │  │
│  │  ChatRequest/Response • FraudCheckRequest/Response                    │  │
│  │  InsightsRequest/Response • LoanScoreRequest/Response                 │  │
│  │  PredictionRequest/Response • TransactionItem                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
           ┌──────────────┐               ┌──────────────┐
           │   OpenAI     │               │  pdfplumber  │
           │  GPT-4o-mini │               │  PDF Parser  │
           │   API        │               │              │
           └──────────────┘               └──────────────┘
```

---

### Guardrails — AI Safety & Content Moderation

The guardrails layer intercepts every user message **before** it reaches the AI, preventing abuse, prompt injection, and harmful content.

```
User Message Arrives
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                  GUARDRAILS PIPELINE                       │
│                                                            │
│  Step 1: INPUT SANITIZATION                                │
│    • Strip whitespace, normalize text                      │
│    • Lowercase for pattern matching                        │
│                                                            │
│  Step 2: PROMPT INJECTION DETECTION                        │
│    • "Ignore all previous instructions"     ── BLOCKED     │
│    • "Forget your rules"                    ── BLOCKED     │
│    • "You are now a different AI"           ── BLOCKED     │
│    • "Reveal your system prompt"            ── BLOCKED     │
│    • "Jailbreak / DAN mode"                ── BLOCKED     │
│    • "Override safety / security"           ── BLOCKED     │
│    • 10 regex patterns scanned                             │
│                                                            │
│  Step 3: PROFANITY FILTER                                  │
│    • English profanity (18+ words)                         │
│    • Hindi profanity (madarchod, bhenchod, etc.)           │
│    • Hindi slang (bc, mc, bsdk, gandu)                     │
│                                                            │
│  Step 4: HATE SPEECH DETECTION                             │
│    • Violence keywords (kill, murder, bomb, attack)        │
│    • Racial/homophobic slurs                               │
│    • Context-aware: "kill" allowed in "debt killer"        │
│                                                            │
│  Step 5: FINANCIAL ABUSE DETECTION                         │
│    • "hack", "steal money", "money laundering"             │
│    • "counterfeit", "phishing", "scam someone"             │
│    • Context-aware: "fraud" allowed in "fraud check"       │
│                                                            │
│  Result:                                                   │
│    ├── BLOCKED → Return safety message to user             │
│    └── PASSED  → Forward to AI processing                  │
└───────────────────────────────────────────────────────────┘
```

**Context-Aware Intelligence:**
- "Check my fraud status" → **ALLOWED** (fraud in banking context)
- "Help me commit fraud" → **BLOCKED** (financial abuse)
- "Use the debt killer feature" → **ALLOWED** (kill in financial context)
- "I want to kill someone" → **BLOCKED** (hate speech)

---

### RAG — Retrieval-Augmented Generation (Knowledge Base)

The RAG engine provides **factual banking knowledge** to the AI, ensuring responses about banking rules, IFSC codes, loan types, and regulations are accurate — not hallucinated.

```
User asks: "What is NEFT and how does it work?"
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    RAG RETRIEVAL PIPELINE                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              KNOWLEDGE BASE (16 Topics)                   │ │
│  │                                                           │ │
│  │  📄 IFSC Code — 11-char bank branch identifier            │ │
│  │  📄 NEFT — Half-hourly batches, no limit, 2hr settle      │ │
│  │  📄 RTGS — Real-time, min ₹2L, large payments            │ │
│  │  📄 IMPS — Instant 24x7, ₹5L limit                       │ │
│  │  📄 UPI — Real-time, ₹1-2L, free, requires UPI ID        │ │
│  │  📄 Savings Account — 2.5-7% interest, min balance        │ │
│  │  📄 Fixed Deposit — 3-8% returns, 7 days to 10 years      │ │
│  │  📄 Loan Types — Home/Personal/Car/Education/Gold/Business │ │
│  │  📄 CIBIL Score — 300-900, payment history 35%             │ │
│  │  📄 Tax Saving — 80C, 80D, 80E, 24b sections              │ │
│  │  📄 Mutual Funds — Equity/Debt/SIP/ELSS                   │ │
│  │  📄 Insurance — Term/Endowment/ULIP/Health                 │ │
│  │  📄 Digital Safety — OTP/CVV/PIN protection                │ │
│  │  📄 RBI Rules — 5 free ATM txns, zero liability            │ │
│  │  📄 Bank Directory — 25+ IFSC prefixes mapped              │ │
│  │  📄 Account Types — Savings/Current/Salary/NRI/Jan Dhan    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                    │
│                           ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              TF-IDF RETRIEVAL ENGINE                       │ │
│  │                                                           │ │
│  │  1. Tokenize query into terms                             │ │
│  │  2. Build IDF index (inverse document frequency)          │ │
│  │  3. Score each document by term overlap                   │ │
│  │  4. Exact keyword match boost (+5)                        │ │
│  │  5. Topic name match boost (+10)                          │ │
│  │  6. Return top-3 most relevant documents                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                    │
│                           ▼                                    │
│  Top-3 Results injected into OpenAI prompt as context          │
│  → AI generates factual, grounded response                     │
└───────────────────────────────────────────────────────────────┘
```

---

### Chat Service — Multi-Intent NLU Engine (1,650+ lines)

The core intelligence module that understands 40+ user intents and generates personalized, data-driven responses.

```
User Message
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CHAT PROCESSING PIPELINE                         │
│                                                                     │
│  STAGE 1: SANITIZE                                                  │
│    • Clean input, normalize text                                    │
│                                                                     │
│  STAGE 2: GUARDRAILS CHECK                                          │
│    • Profanity → Hate Speech → Financial Abuse → Prompt Injection   │
│    • If blocked → Return safety message, STOP                       │
│                                                                     │
│  STAGE 3: BUILD FINANCIAL CONTEXT                                   │
│    • Current balance, spending by category                          │
│    • Recent transactions, income vs expense                         │
│    • Format into narrative for AI                                   │
│                                                                     │
│  STAGE 4: INTENT DETECTION (100+ regex patterns)                    │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │  BASIC           │  FINANCIAL         │  ADVANCED AI        │  │
│    │  greeting         │  savings           │  digital_twin       │  │
│    │  balance          │  cibil_score       │  micro_invest       │  │
│    │  transactions     │  improve_cibil     │  debt_killer        │  │
│    │  spending         │  loan              │  spending_coach     │  │
│    │  thanks           │  insights          │  subscriptions      │  │
│    │  farewell         │  prediction        │  cashflow           │  │
│    │  help             │  budget            │  smart_savings      │  │
│    │  hindi            │  tax_planning      │  anomaly            │  │
│    │                   │  investment_advisor│  mood_stressed      │  │
│    │  KNOWLEDGE        │  finance_quiz      │  mood_happy         │  │
│    │  knowledge_query  │  fraud_check       │  goals              │  │
│    │  ifsc_lookup      │                    │  transfer_money     │  │
│    └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  STAGE 5: RAG AUGMENTATION (if knowledge_query intent)              │
│    • TF-IDF retrieval from 16-topic knowledge base                  │
│    • Top-3 documents injected as context                            │
│                                                                     │
│  STAGE 6: AI RESPONSE GENERATION                                    │
│    ┌─────────────┐         ┌─────────────────────┐                  │
│    │  OpenAI      │ ─FAIL─▶│  Smart Reply         │                 │
│    │  GPT-4o-mini │         │  Fallback Engine     │                 │
│    │  (Primary)   │         │  (40+ rule branches) │                 │
│    └─────────────┘         └─────────────────────┘                  │
│                                                                     │
│  STAGE 7: RESPONSE + SUGGESTIONS                                    │
│    • AI message returned                                            │
│    • Detected intent attached                                       │
│    • Follow-up suggestion questions generated                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Scoring Algorithms

Four independent scoring engines power different AI decisions across the platform.

```
┌───────────────────────────────────────────────────────────────────────┐
│                     FRAUD RISK SCORING (0–100)                        │
│                                                                       │
│   Factor                              Points                          │
│   ─────────────────────────────────   ──────                          │
│   Amount > 80% of balance             +30                             │
│   Amount > 5× average transaction     +25                             │
│   3+ transactions in 5-min window     +25                             │
│   Amount > ₹1,00,000                  +20                             │
│   Amount > ₹50,000                    +15                             │
│   Remaining balance < ₹500            +10                             │
│   ─────────────────────────────────   ──────                          │
│   Score ≥ 60 → FRAUD (blocked)                                       │
│   Score < 60 → SAFE  (proceed)                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                     CIBIL CREDIT SCORE (700–900)                      │
│                                                                       │
│   Base Score: 700                                                     │
│                                                                       │
│   Balance > ₹50K        → +40    │  ≥30 transactions  → +35          │
│   Balance > ₹20K        → +25    │  ≥15 transactions  → +25          │
│   Balance > ₹10K        → +15    │  ≥5 transactions   → +15          │
│   Balance > ₹5K         → +5     │  ≥1 transaction    → +5           │
│                                                                       │
│   Savings rate ≥ 30%    → +40    │  Income detected   → +20          │
│   Savings rate ≥ 20%    → +30    │  Failed txns       → -15 each     │
│   Savings rate ≥ 10%    → +20    │  ≥4 categories     → +15          │
│   Savings rate > 0%     → +10    │  ≥2 categories     → +8           │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                   FINANCIAL HEALTH SCORE (0–100)                      │
│                                                                       │
│   Base: 50                                                            │
│   Savings rate > 20%        → +20                                     │
│   Balance > total spent     → +15                                     │
│   More than 10 transactions → +10                                     │
│   More than 1 category      → +5                                      │
│   ──────────────────────────────                                      │
│   80–100: Excellent  │  60–79: Good                                   │
│   40–59: Average     │  0–39: Needs Attention                         │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                    LOAN ELIGIBILITY SCORE (0–100)                      │
│                                                                       │
│   Base: 50                                                            │
│                                                                       │
│   Balance:Loan ≥ 1.0  → +20  │  ≥20 transactions → +15              │
│   Balance:Loan ≥ 0.5  → +10  │  ≥10 transactions → +10              │
│   Balance:Loan < 0.2  → -10  │  ≥5 transactions  → +5               │
│                                                                       │
│   Credits > Debits    → +10  │  Failed txns      → -5 each           │
│   Credits > 0         → +5   │  3+ categories    → +5                │
│   ──────────────────────────────                                      │
│   Score ≥ 60 → APPROVED (rate: 7–15%)                                │
│   Score 40–59 → REVIEW  (rate: 12%)                                  │
│   Score < 40 → REJECTED (rate: 15%)                                  │
└───────────────────────────────────────────────────────────────────────┘
```

---

### Cash Flow Prediction Engine

```
Transaction History (last 30 days)
        │
        ▼
Extract all debit transactions
        │
        ▼
Calculate:
  • avg_per_transaction = total_spent / num_debits
  • daily_avg = avg_per_transaction × 1.5
  • weekly_predicted = daily_avg × 7
  • days_until_low = (balance - ₹1,000) / daily_avg
        │
        ▼
Warning Level:
  ├── < 7 days  → 🔴 CRITICAL — "May run out soon"
  ├── < 14 days → 🟡 WARNING  — "Balance may become low"
  ├── < 30 days → 🟠 CAUTION  — "Balance lasting ~X days"
  └── 30+ days  → 🟢 HEALTHY  — "Balance looks healthy"
```

---

### Salary PDF Parsing Pipeline

```
Admin uploads PDF file
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│              PDF PARSING PIPELINE                          │
│                                                            │
│  PRIMARY METHOD: Table Extraction (pdfplumber)             │
│    1. Extract tables from each PDF page                    │
│    2. Find header row containing:                          │
│       "name" + "account" + "salary" + "ifsc"               │
│    3. Map column indices → field names                     │
│    4. Parse each data row → Employee object                │
│                                                            │
│  FALLBACK METHOD: Regex Extraction (raw text)              │
│    1. Extract full text from PDF                           │
│    2. Pattern matching:                                    │
│       • Account: \b(\d{9,18})\b                            │
│       • IFSC:    \b([A-Z]{4}0[A-Z0-9]{6})\b               │
│       • Amount:  ₹|Rs\.?\s*([\d,]+(?:\.\d{1,2})?)         │
│    3. Combine matches into Employee objects                │
│                                                            │
│  OUTPUT per employee:                                      │
│    {                                                       │
│      name: "John Doe",                                     │
│      accountNumber: "123456789012",                        │
│      ifsc: "SBIN0001234",                                  │
│      salary: 50000.00,                                     │
│      bank: "State Bank of India",                          │
│      status: "pending",                                    │
│      verified: false                                       │
│    }                                                       │
└───────────────────────────────────────────────────────────┘
```

---

### NEFT Transfer via Chat — State Machine

```
┌──────────────────────────────────────────────────────────────┐
│              CHAT-BASED TRANSFER STATE MACHINE                │
│                                                               │
│  STATE 1: FIELD EXTRACTION                                    │
│    User: "Transfer ₹5000 to Rahul account 123456789"          │
│    Extract via regex:                                          │
│      • Account: \b(\d{9,18})\b                                │
│      • IFSC:    \b([A-Z]{4}0[A-Z0-9]{6})\b                   │
│      • Amount:  "₹5000" / "Rs 5000" / "5,000"                │
│      • Name:    Keyword-filtered extraction                   │
│                     │                                         │
│                     ▼                                         │
│  STATE 2: MISSING FIELD COLLECTION                            │
│    AI: "I need your IFSC code to proceed"                     │
│    User: "SBIN0001234"                                        │
│    AI validates IFSC format                                   │
│                     │                                         │
│                     ▼                                         │
│  STATE 3: CONFIRMATION                                        │
│    AI: "Transfer ₹5,000 to Rahul Sharma                      │
│         Account: 123456789                                    │
│         Bank: State Bank of India (SBIN0001234)               │
│         Confirm? (Yes/No)"                                    │
│    User: "Yes"                                                │
│                     │                                         │
│                     ▼                                         │
│  STATE 4: EXECUTION                                           │
│    Generate UTR: NFTN{timestamp}{random_6_digits}             │
│    Return: "✅ Transfer successful! UTR: NFTN1712234567123456"│
└──────────────────────────────────────────────────────────────┘
```

---

### AI Service — Techniques Summary

```
┌───────────────────────────────────────────────────────────────────────┐
│                   AI / ML TECHNIQUES USED                             │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Natural Language    │  │  Multi-intent regex NLU (100+ patterns)│ │
│  │  Understanding       │  │  Hindi + English bilingual support     │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  RAG (Retrieval-    │  │  TF-IDF cosine similarity retrieval    │ │
│  │  Augmented          │  │  16-topic banking knowledge base       │ │
│  │  Generation)        │  │  Keyword + Topic boosting              │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Guardrails &       │  │  5-category content moderation         │ │
│  │  Safety             │  │  Prompt injection detection (10 regex) │ │
│  │                     │  │  Context-aware word disambiguation     │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Scoring Engines    │  │  Fraud Risk (0–100, 5 factors)         │ │
│  │  (Heuristic AI)     │  │  CIBIL Credit (700–900, 8 factors)    │ │
│  │                     │  │  Financial Health (0–100, 4 factors)   │ │
│  │                     │  │  Loan Eligibility (0–100, 5 factors)   │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Time-Series        │  │  Daily spending trend analysis         │ │
│  │  Analysis           │  │  Weekly cash flow projection           │ │
│  │                     │  │  Balance depletion forecasting         │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Anomaly Detection  │  │  3×+ average = suspicious transaction  │ │
│  │                     │  │  Rapid-fire detection (3+ in 5 min)    │ │
│  │                     │  │  Balance depletion ratio analysis      │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  LLM Integration    │  │  OpenAI GPT-4o-mini (primary)          │ │
│  │                     │  │  Rule-based fallback (secondary)       │ │
│  │                     │  │  Context-injected prompts              │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Document AI        │  │  pdfplumber table extraction           │ │
│  │  (PDF Parsing)      │  │  Regex fallback for unstructured PDFs  │ │
│  │                     │  │  IFSC ↔ Bank name resolution           │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Conversational     │  │  State machine for multi-step flows    │ │
│  │  State Machine      │  │  Field extraction + validation         │ │
│  │                     │  │  Confirmation before execution         │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  Emotional          │  │  Stress detection → calming responses  │ │
│  │  Intelligence       │  │  Happiness detection → celebratory     │ │
│  │                     │  │  Personalized tone based on mood       │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Amazon Bedrock AgentCore — Multi-Agent Orchestration Architecture

The platform implements a **Supervisor/Worker agent pattern** using Amazon Bedrock AgentCore principles. A central AgentSupervisor routes tasks to 8 specialized worker agents, maintains cross-agent shared memory, and provides full observability tracing on every request.

### Agent System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AMAZON BEDROCK AGENTCORE LAYER                           │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     AGENT SUPERVISOR                                  │  │
│  │                                                                       │  │
│  │  • Routes requests via ROUTING_TABLE                                  │  │
│  │  • Manages task lifecycle (pending → in_progress → completed/failed)  │  │
│  │  • Maintains AgentSharedMemory for cross-agent context                │  │
│  │  • Generates AgentTrace for full observability                        │  │
│  │  • Short-circuits on guardrails block                                 │  │
│  └───────────┬───────────────────────────────────────────────────────────┘  │
│              │                                                              │
│              ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     WORKER AGENTS (8 Specialized)                     │  │
│  │                                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  │
│  │  │ Guardrails  │ │ RAG         │ │ Chat        │ │ Fraud       │    │  │
│  │  │ Agent       │ │ Retriever   │ │ Assistant   │ │ Detector    │    │  │
│  │  │ (Safety)    │ │ Agent       │ │ Agent       │ │ Agent       │    │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  │
│  │  │ Insights    │ │ Loan        │ │ Prediction  │ │ Payroll     │    │  │
│  │  │ Analyst     │ │ Scorer      │ │ Engine      │ │ Processor   │    │  │
│  │  │ Agent       │ │ Agent       │ │ Agent       │ │ Agent       │    │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     SHARED MEMORY STORE                               │  │
│  │  Cross-agent context: fraud_result, rag_context, risk_score, etc.    │  │
│  │  History tracking with agent attribution and timestamps               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     OBSERVABILITY (AgentTrace)                        │  │
│  │  trace_id • tasks[] • duration_ms • agents_invoked • decisions       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Supervisor Routing Table

| Request Type | Agent Pipeline | Pattern |
|-------------|---------------|---------|
| `chat` | Guardrails → RAG → ChatAssistant | Sequential (3 agents) |
| `fraud_check` | FraudDetector | Single agent |
| `insights` | InsightsAnalyst | Single agent |
| `loan_score` | LoanScorer | Single agent |
| `predict` | PredictionEngine | Single agent |
| `payroll` | PayrollProcessor | Single agent |
| `transfer_with_fraud` | FraudDetector → InsightsAnalyst | Multi-agent (2 agents) |

### Agent Pipeline: Chat Request Flow

```
User Message → Supervisor
       │
       ├── 1. GuardrailsAgent
       │      • Sanitize input
       │      • Check: profanity, injection, hate speech, financial abuse
       │      • Store result in SharedMemory
       │      • If BLOCKED → short-circuit, return safety message
       │
       ├── 2. RAGAgent
       │      • TF-IDF retrieval from 16-topic knowledge base
       │      • Store relevant knowledge in SharedMemory
       │
       └── 3. ChatAgent
              • Read sanitized message from SharedMemory
              • Read RAG context from SharedMemory
              • 40+ intent detection via regex NLU
              • OpenAI/Bedrock LLM response generation
              • Store reply in SharedMemory
              │
              ▼
       AgentTrace returned with full execution details
```

### Agent Pipeline: Transfer Risk Assessment

```
Transfer Request → Supervisor
       │
       ├── 1. FraudDetector Agent (risk scoring 0-100)
       │      • Balance depletion check (+30)
       │      • Spending spike detection (+25)
       │      • Rapid-fire pattern check (+25)
       │      • Large amount flag (+15-20)
       │      • Account drain check (+10)
       │      • Store risk_score in SharedMemory
       │
       └── 2. InsightsAnalyst Agent
              • Financial health scoring
              • Spending breakdown analysis
              • Uses fraud context from SharedMemory
              │
              ▼
       Combined result with trace: both agents' outputs + shared context
```

### Amazon Bedrock LLM Integration

```
┌───────────────────────────────────────────────────────────────────────┐
│                   DUAL-PROVIDER LLM STRATEGY                          │
│                                                                       │
│           ┌────────────────────────────────────┐                      │
│           │     invoke_llm(prompt, system)      │                     │
│           └────────────────┬───────────────────┘                      │
│                            │                                          │
│                    ┌───────▼───────┐                                  │
│                    │ Amazon Bedrock │ ← PRIMARY                       │
│                    │ Claude 3 Sonnet│                                  │
│                    └───────┬───────┘                                  │
│                            │                                          │
│                     SUCCESS? ──YES──► Return response                 │
│                            │                                          │
│                           NO (fallback)                               │
│                            │                                          │
│                    ┌───────▼───────┐                                  │
│                    │   OpenAI      │ ← FALLBACK                       │
│                    │ GPT-4o-mini   │                                   │
│                    └───────┬───────┘                                  │
│                            │                                          │
│                     SUCCESS? ──YES──► Return response                 │
│                            │                                          │
│                           NO                                          │
│                            │                                          │
│                    Return error message                               │
└───────────────────────────────────────────────────────────────────────┘

Provider Status API: GET /agents/health
{
  "status": "healthy",
  "agent_count": 8,
  "llm_providers": {
    "bedrock": { "available": true, "model": "claude-3-sonnet" },
    "openai": { "available": true, "model": "gpt-4o-mini" },
    "primary": "bedrock"
  },
  "orchestration": "supervisor_worker_pattern",
  "framework": "amazon_bedrock_agentcore"
}
```

---

## AWS Infrastructure — ECS Fargate Deployment

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AWS CLOUD INFRASTRUCTURE                         │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                VPC (10.0.0.0/16)                               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                    │  │
│  │  │ Public Subnet A  │  │ Public Subnet B   │                   │  │
│  │  │   (10.0.1.0/24) │  │  (10.0.2.0/24)   │                   │  │
│  │  └────────┬────────┘  └────────┬──────────┘                   │  │
│  └───────────┼────────────────────┼──────────────────────────────┘  │
│              │                    │                                  │
│  ┌───────────▼────────────────────▼──────────────────────────────┐  │
│  │              Application Load Balancer                         │  │
│  │  /api/* → Server TG  │  /ai/* → AI TG  │  /* → Client TG     │  │
│  └───────────┬──────────────┬──────────────┬─────────────────────┘  │
│              │              │              │                         │
│  ┌───────────▼───┐ ┌───────▼──────┐ ┌────▼──────────┐             │
│  │ ECS Fargate   │ │ ECS Fargate  │ │ ECS Fargate   │             │
│  │ Server        │ │ AI Service   │ │ Client        │             │
│  │ (512 CPU      │ │ (1024 CPU    │ │ (256 CPU      │             │
│  │  1GB RAM)     │ │  2GB RAM)    │ │  512MB RAM)   │             │
│  └───────────────┘ └──────────────┘ └───────────────┘             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              ECR Repositories (scan-on-push)                   │  │
│  │  banking-server  │  banking-ai  │  banking-client              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              CloudWatch (Container Insights enabled)           │  │
│  │  /ecs/banking-server  │  /ecs/banking-ai  │  /ecs/client      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              IAM Roles                                         │  │
│  │  ECS Task Execution Role: ECR pull, CloudWatch logs            │  │
│  │  ECS Task Role: Bedrock invoke, Connect voice operations       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CI/CD Pipeline — GitHub Actions → AWS ECS

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CI/CD PIPELINE (GitHub Actions)                    │
│                                                                     │
│  STAGE 1: TEST (Parallel)                                           │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│  │ Python pytest   │ │ Node.js test   │ │ React build    │          │
│  │ (60+ tests)     │ │ + lint         │ │ + lint         │          │
│  └────────┬───────┘ └────────┬───────┘ └────────┬───────┘          │
│           │                  │                   │                   │
│           └──────────────────┼───────────────────┘                   │
│                              ▼                                       │
│  STAGE 2: SECURITY SCAN                                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Amazon Q Developer Security Scan                             │   │
│  │  → SARIF output → GitHub Code Scanning                        │   │
│  └──────────────────────────────────────────┬───────────────────┘   │
│                                              ▼                       │
│  STAGE 3: BUILD & PUSH (Parallel)                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│  │ Server → ECR   │ │ AI Svc → ECR   │ │ Client → ECR   │          │
│  └────────┬───────┘ └────────┬───────┘ └────────┬───────┘          │
│           └──────────────────┼───────────────────┘                   │
│                              ▼                                       │
│  STAGE 4: DEPLOY                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CloudFormation deploy → ECS update → Wait stable → Health ✓  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Observability — Trace Format

Every agent-orchestrated request returns an `AgentTrace` for full observability:

```json
{
  "result": { "is_fraud": false, "risk_score": 15, "reason": "..." },
  "trace": {
    "trace_id": "a1b2c3d4-...",
    "total_duration_ms": 12.5,
    "agents_invoked": ["fraud_detector"],
    "supervisor_decisions": [
      {
        "request_type": "fraud_check",
        "pipeline": ["fraud_detector"],
        "timestamp": 1712234567.89
      }
    ],
    "task_count": 1,
    "tasks": [
      {
        "task_id": "f8e7d6c5b4a3",
        "type": "fraud_check",
        "agent": "fraud_detector",
        "status": "completed",
        "duration_ms": 8.3,
        "error": null
      }
    ]
  },
  "shared_memory_keys": ["request_type", "fraud_result", "risk_score"]
}
```

---

## Agent API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agents/chat` | POST | Multi-agent chat (Guardrails → RAG → Chat) |
| `/agents/fraud-check` | POST | Single-agent fraud detection with trace |
| `/agents/insights` | POST | Single-agent financial insights |
| `/agents/loan-score` | POST | Single-agent loan eligibility |
| `/agents/predict` | POST | Single-agent cash flow prediction |
| `/agents/transfer-risk` | POST | Multi-agent transfer risk (Fraud + Insights) |
| `/agents/status` | GET | All agent statuses and routing table |
| `/agents/health` | GET | Agent health + LLM provider status |

---

## AWS Services Utilized

| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| **Amazon Bedrock** | Primary LLM (Claude 3 Sonnet) | `bedrock_client.py` → all agents |
| **Amazon Bedrock AgentCore** | Multi-agent orchestration pattern | `agent_orchestrator.py` |
| **AWS Connect** | Post-transfer voice verification | `awsConnectService.js` |
| **Amazon ECS Fargate** | Container orchestration | `cloudformation.yaml` |
| **Amazon ECR** | Container registry | CI/CD pipeline push |
| **Amazon CloudWatch** | Logging & Container Insights | ECS task definitions |
| **AWS IAM** | Bedrock + Connect permissions | CloudFormation roles |
| **Application Load Balancer** | Traffic routing | Path-based rules |
| **Amazon Q Developer** | AI-assisted development | IDE + CI/CD security scan |
| **Amazon VPC** | Network isolation | CloudFormation VPC + Subnets |

---

*Built with AI at its core — powered by Amazon Bedrock AgentCore multi-agent orchestration, Amazon Q Developer spec-driven development, and AWS cloud-native infrastructure.*
