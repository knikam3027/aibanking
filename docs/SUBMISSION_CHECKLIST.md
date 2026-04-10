# Submission Checklist & Setup Guide

## AI Banking Platform | Wipro × AWS Codeathon 2026

---

## Deliverables Checklist

| # | Deliverable | Status | Location |
|---|-------------|--------|----------|
| 1 | Working Application (deployed) | ✅ | Docker Compose / AWS ECS |
| 2 | Source Code Repository | ✅ | GitHub (this repo) |
| 3 | Amazon Q Usage Report | ✅ | `docs/AMAZON_Q_USAGE_REPORT.md` |
| 4 | Productivity Metrics | ✅ | `docs/PRODUCTIVITY_METRICS.md` |
| 5 | Demo Video (5-min) | ⬜ | Record walkthrough |
| 6 | Technical Documentation | ✅ | `ARCHITECTURE.md` (1200+ lines) |

---

## Quick Start — Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- AWS account with Bedrock access enabled

### Option 1: Docker Compose (Recommended)
```bash
docker compose up --build
```
- Client: http://localhost (port 80)
- Server: http://localhost:5000
- AI Service: http://localhost:8000
- Agent Health: http://localhost:8000/agents/health

### Option 2: Manual Start
```bash
# Terminal 1 — AI Service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Server
cd server
npm install
npm run dev

# Terminal 3 — Client
cd client
npm install
npm run dev
```

---

## AWS Deployment

### Prerequisites
- AWS CLI configured with appropriate credentials
- Amazon Bedrock access enabled in your region
- Environment variables set: `MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`

### Deploy to ECS Fargate
```bash
chmod +x infrastructure/deploy.sh
./infrastructure/deploy.sh production us-west-2
```

### Verify Deployment
```bash
# Check agent health
curl http://<ALB_URL>/agents/health

# Expected response:
{
  "status": "healthy",
  "agent_count": 8,
  "orchestration": "supervisor_worker_pattern",
  "framework": "amazon_bedrock_agentcore"
}
```

---

## Run Tests

### AI Service (Python — 70 tests)
```bash
cd ai-service
pip install -r requirements.txt
pytest tests/ -v
```

### Server (Node.js — 18 tests)
```bash
cd server
npm install
npm test
```

---

## Project Structure (Post-Enhancement)

```
banking_platfrom/
├── ARCHITECTURE.md                      # Full architecture docs (1200+ lines)
├── README.md                            # Project README
├── docker-compose.yml                   # Multi-service containerization
│
├── .kiro/
│   ├── steering.md                      # KIRO steering rules
│   └── spec.md                          # KIRO specification
│
├── .github/workflows/
│   └── deploy.yml                       # CI/CD: Test → Scan → Build → Deploy
│
├── infrastructure/
│   ├── cloudformation.yaml              # AWS IaC (VPC, ECS, ALB, ECR, IAM)
│   └── deploy.sh                        # One-command AWS deployment
│
├── docs/
│   ├── AMAZON_Q_USAGE_REPORT.md         # Detailed Q Developer usage report
│   └── PRODUCTIVITY_METRICS.md          # Time savings & quality metrics
│
├── ai-service/                          # Python FastAPI AI Microservice
│   ├── app/
│   │   ├── main.py                      # FastAPI app (v2.0 with agent routes)
│   │   ├── routes/
│   │   │   ├── agents.py                # 🆕 Agent orchestration REST API
│   │   │   ├── chat.py
│   │   │   ├── fraud.py
│   │   │   ├── insights.py
│   │   │   ├── loan.py
│   │   │   ├── prediction.py
│   │   │   └── payroll.py
│   │   ├── services/
│   │   │   ├── agent_orchestrator.py    # 🆕 Supervisor/Worker agent system
│   │   │   ├── bedrock_client.py        # 🆕 Bedrock LLM + OpenAI fallback
│   │   │   ├── observability.py         # 🆕 Structured logging & tracing
│   │   │   ├── chat_service.py
│   │   │   ├── fraud_service.py
│   │   │   ├── insights_service.py
│   │   │   ├── loan_service.py
│   │   │   ├── prediction_service.py
│   │   │   ├── pdf_service.py
│   │   │   ├── guardrails.py
│   │   │   ├── rag_service.py
│   │   │   └── transfer_service.py
│   │   └── schemas/models.py
│   └── tests/                           # 🆕 70 automated tests
│       ├── test_agent_orchestrator.py
│       ├── test_bedrock_client.py
│       ├── test_routes.py
│       └── test_services.py
│
├── server/                              # Node.js/Express Backend
│   └── src/
│       ├── test.js                      # 🆕 18 automated tests
│       └── ...
│
└── client/                              # React 19 Frontend
    └── ...
```

---

## Evaluation Criteria Coverage

### 1. Application Quality & Functionality (30 pts)
- ✅ 28 features across banking, AI, security, and admin
- ✅ Multi-agent architecture with supervisor/worker pattern
- ✅ 88 automated tests (70 Python + 18 Node.js)
- ✅ Error handling with graceful fallbacks
- ✅ Docker Compose + CloudFormation deployment

### 2. Amazon Q Feature Utilization (30 pts)
- ✅ KIRO steering rules (`.kiro/steering.md`)
- ✅ KIRO specification (`.kiro/spec.md`)
- ✅ Multi-file coordination (12+ files in single session)
- ✅ Amazon Q security scanning in CI/CD
- ✅ Detailed usage report (`docs/AMAZON_Q_USAGE_REPORT.md`)

### 3. Productivity Demonstration (20 pts)
- ✅ 89% time savings documented
- ✅ 4× sprint velocity increase
- ✅ Before/after comparisons
- ✅ Specific time metrics per feature (`docs/PRODUCTIVITY_METRICS.md`)

### 4. Innovation & Creativity (20 pts)
- ✅ 8-agent supervisor/worker orchestration
- ✅ Dual LLM provider strategy (Bedrock + OpenAI)
- ✅ Cross-agent shared memory
- ✅ Full observability (AgentTrace on every request)
- ✅ 3-layer fraud prevention (AI + Exotel IVR + AWS Connect)
- ✅ Context-aware guardrails (financial abuse vs legitimate queries)

---

## Demo Video Script (5 minutes)

1. **0:00 - 0:30** — Introduction & architecture overview
2. **0:30 - 1:30** — Agent health endpoint + multi-agent status
3. **1:30 - 2:30** — Live chat with guardrails → RAG → ChatAgent pipeline
4. **2:30 - 3:15** — Transfer with fraud detection (multi-agent trace)
5. **3:15 - 3:45** — Financial insights & loan eligibility via agents
6. **3:45 - 4:15** — CI/CD pipeline & CloudFormation infrastructure
7. **4:15 - 4:45** — Test suite execution (70 Python + 18 Node.js)
8. **4:45 - 5:00** — Amazon Q usage highlights + productivity summary
