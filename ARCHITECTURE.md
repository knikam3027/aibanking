# AI Banking Platform Architecture

## Overview

This repository implements a three-tier banking platform:

1. `client/` is a React 19 + Vite frontend for users and admins.
2. `server/` is a Node.js + Express API that owns authentication, account state, transactions, alerts, payroll orchestration, and third-party voice integrations.
3. `ai-service/` is a Python FastAPI service that provides fraud checks, chat responses, insights, predictions, loan scoring, payroll PDF parsing, and a multi-agent orchestration layer.

MongoDB is the system of record. The Node.js server is the primary application backend and calls the AI service over HTTP for AI-assisted features.

## Repository Structure

```text
banking_platfrom/
|-- client/                 # React frontend
|   `-- src/
|       |-- pages/          # User + admin screens
|       |-- components/     # Layout and route protection
|       |-- context/        # Auth state
|       `-- services/       # API client helpers
|-- server/                 # Express application
|   `-- src/
|       |-- config/         # MongoDB connection
|       |-- controllers/    # Route handlers
|       |-- middleware/     # JWT auth + admin guard
|       |-- models/         # Mongoose schemas
|       |-- routes/         # API route modules
|       |-- services/       # Exotel and AWS Connect integrations
|       `-- setup/          # Connect setup helpers
|-- ai-service/             # FastAPI AI service
|   `-- app/
|       |-- routes/         # AI HTTP endpoints
|       |-- schemas/        # Pydantic request/response models
|       `-- services/       # AI logic, orchestration, guardrails, RAG, observability
|-- infrastructure/         # AWS CloudFormation + deploy scripts
|-- docs/                   # Submission and project docs
`-- docker-compose.yml      # Local multi-service startup
```

## Runtime Architecture

### Local Development

```text
Browser
  |
  v
React + Vite client (localhost:5173)
  |
  | /api/*
  v
Express API (localhost:5000)
  |
  +--> MongoDB
  |
  +--> FastAPI AI service (configured via AI_SERVICE_URL)
  |
  +--> Exotel API for voice-verified transfers
  |
  +--> AWS Connect for post-transfer verification
```

### AWS Deployment

The CloudFormation stack in [infrastructure/cloudformation.yaml](</c:/Users/ADMIN/banking_platfrom/infrastructure/cloudformation.yaml>) provisions:

- A VPC with two public subnets.
- An internet-facing Application Load Balancer.
- Three ECS Fargate services:
  - client on port `80`
  - server on port `5000`
  - AI service on port `8000`
- Three ECR repositories for the deployable images.
- CloudWatch log groups for each service.
- IAM roles for ECS execution, Bedrock access, and AWS Connect operations.

ALB path routing is configured as:

- `/api/*` -> Express server target group
- `/ai/*` -> AI service target group
- `/*` -> frontend target group

## Frontend Architecture

The frontend entrypoint is [client/src/App.jsx](</c:/Users/ADMIN/banking_platfrom/client/src/App.jsx>). It uses:

- `react-router-dom` for routing
- `AuthProvider` for auth/session state
- `ProtectedRoute` for authenticated user pages
- `AdminRoute` for admin-only pages

### User Screens

- `Dashboard`
- `Transactions`
- `Transfer`
- `Loans`
- `Insights`
- `Chat`
- `Alerts`

### Admin Screens

- `AdminDashboard`
- `AdminUsers`
- `AdminPayroll`
- `AdminWithdraw`
- `AdminHeldAccounts`

In local development, [client/vite.config.js](</c:/Users/ADMIN/banking_platfrom/client/vite.config.js>) proxies `/api` requests to `http://localhost:5000`.

## Express Server Architecture

The Node.js application boots from [server/src/server.js](</c:/Users/ADMIN/banking_platfrom/server/src/server.js>).

### Responsibilities

- Connect to MongoDB
- Expose REST APIs for banking operations
- Enforce JWT authentication and admin authorization
- Persist application state in MongoDB
- Delegate AI tasks to the FastAPI service
- Trigger Exotel and AWS Connect workflows

### Route Modules

- `/api/auth` -> registration and login
- `/api/user` -> user profile endpoints
- `/api/account` -> account details
- `/api/transactions` -> history, instant transfer, voice transfer, pending transfer status
- `/api/loans` -> loan eligibility and related flows
- `/api/ai` -> chat, insights, predictions, cashflow, AI-assisted transfer
- `/api/alerts` -> alert retrieval and management
- `/api/admin` -> admin dashboard, user management, held account actions, bank balance ops
- `/api/admin/payroll` -> payroll processing endpoints
- `/api/exotel` -> Exotel callback/public routes
- `/api/connect` -> AWS Connect verification routes

### Cross-Cutting Middleware

- `middleware/auth.js` authenticates JWTs and attaches `req.userId`
- `middleware/admin.js` restricts admin-only operations

## Data Model

The main MongoDB collections are represented by these Mongoose models:

- `User`
- `Account`
- `Transaction`
- `Alert`
- `Loan`
- `AiInsight`
- `ChatHistory`
- `PendingTransfer`
- `PostTransferVerification`
- `PayrollBatch`

### Ownership Boundaries

- `Account` stores account number, balance, and hold state.
- `Transaction` stores debit/credit ledger entries and blocked/success status.
- `PendingTransfer` stores Exotel voice-verification transfers before completion.
- `PostTransferVerification` stores large-transfer follow-up checks handled by AWS Connect.
- `AiInsight` and `ChatHistory` persist user-facing AI outputs.

## AI Service Architecture

The FastAPI application starts from [ai-service/app/main.py](</c:/Users/ADMIN/banking_platfrom/ai-service/app/main.py>).

### Standard AI Endpoints

- `POST /chat`
- `POST /fraud-check`
- `POST /insights`
- `POST /predict-expense`
- `POST /loan-score`
- `POST /parse-salary-pdf`

These endpoints are called primarily by the Express server.

### Agent-Orchestrated Endpoints

The agent layer is exposed from [ai-service/app/routes/agents.py](</c:/Users/ADMIN/banking_platfrom/ai-service/app/routes/agents.py>):

- `POST /agents/chat`
- `POST /agents/fraud-check`
- `POST /agents/insights`
- `POST /agents/loan-score`
- `POST /agents/predict`
- `POST /agents/transfer-risk`
- `GET /agents/status`
- `GET /agents/health`

### AI Service Modules

- `chat_service.py` handles conversational replies
- `fraud_service.py` evaluates transfer risk
- `insights_service.py` generates financial summaries and breakdowns
- `prediction_service.py` estimates future expenses/balance risk
- `loan_service.py` scores loan requests
- `pdf_service.py` extracts payroll rows from uploaded PDFs
- `agent_orchestrator.py` coordinates multi-agent execution
- `guardrails.py` and `rag_service.py` support safer, richer responses
- `observability.py` emits trace metadata for agent requests
- `bedrock_client.py` encapsulates LLM provider access

## Core Request Flows

### 1. Standard Transfer

```text
Client -> POST /api/transactions/transfer
      -> Express validates sender/receiver/balance/hold status
      -> Express calls AI service POST /fraud-check
      -> If fraud suspected:
           create blocked transaction + fraud alert
      -> Else:
           update sender and receiver balances
           create debit and credit transaction rows
      -> If amount >= 100000:
           create PostTransferVerification
           trigger AWS Connect outbound call asynchronously
```

### 2. Voice-Verified Transfer

```text
Client -> POST /api/transactions/transfer-voice
      -> Express validates request
      -> Local risk assessment via exotelService.assessTransferRisk()
      -> Create PendingTransfer document
      -> Trigger Exotel outbound verification call
      -> Client polls GET /api/transactions/pending/:id
      -> Transfer remains pending until verification flow completes
```

### 3. AI Chat

```text
Client -> POST /api/ai/chat
      -> Express loads account, recent transactions, recent chat history
      -> Store user message in ChatHistory
      -> Call AI service POST /chat
      -> On AI failure, use server-side fallback reply generation
      -> Store assistant response in ChatHistory
      -> Return reply to client
```

### 4. Insights and Prediction

```text
Client -> GET /api/ai/insights or /api/ai/predict-balance or /api/ai/cashflow
      -> Express loads account + recent transactions
      -> For insights/prediction, call AI service
      -> On failure, use local fallback calculations
      -> Persist insights when applicable
      -> Return charts/summary data to frontend
```

### 5. Payroll Processing

```text
Admin uploads salary PDF
      -> Express payroll route receives file
      -> FastAPI POST /parse-salary-pdf extracts employee rows
      -> Express verifies target accounts and amounts
      -> Payroll batch metadata is stored in MongoDB
      -> Admin completes payment workflow from the UI
```

## External Integrations

### Exotel

[server/src/services/exotelService.js](</c:/Users/ADMIN/banking_platfrom/server/src/services/exotelService.js>) is used for:

- starting voice verification calls
- polling call status
- simple server-side transfer risk classification for the voice-transfer flow

If credentials are missing, the service falls back to simulation behavior instead of crashing the transfer flow.

### AWS Connect

[server/src/services/awsConnectService.js](</c:/Users/ADMIN/banking_platfrom/server/src/services/awsConnectService.js>) is used for:

- outbound post-transfer verification calls
- reading verification results from contact attributes

This flow is currently triggered for transfers of `>= 100000`.

### Amazon Bedrock and OpenAI

The AI service is configured to use Bedrock-oriented orchestration and provider abstraction. The infrastructure stack also passes:

- `BEDROCK_MODEL_ID`
- `OPENAI_API_KEY`
- `AWS_REGION`

This allows the AI service to expose provider status and support multi-provider AI logic through `bedrock_client.py`.

## Security Model

- JWT protects authenticated user endpoints.
- Admin routes require both auth and admin middleware.
- Accounts can be marked as held; held accounts cannot initiate transfers.
- Fraud checks can block suspicious transfers before funds move.
- Large transfers can trigger asynchronous post-transfer verification.
- Voice-transfer flows require a phone number and create pending records rather than directly moving funds.

## Operational Notes

- The Express service is the system coordinator; the AI service is stateless application logic plus agent orchestration.
- The AI service has graceful fallbacks at the server layer for chat, insights, and prediction when the AI backend is unavailable.
- The deployment design assumes MongoDB is external to the CloudFormation stack, typically MongoDB Atlas via `MongoDBUri`.
- Health endpoints:
  - Express: `GET /api/health`
  - FastAPI: `GET /`
  - Agent layer: `GET /agents/health`

## Summary

The implemented architecture is a modular banking platform where:

- the frontend handles user and admin experiences,
- the Express backend owns business transactions and persistence,
- the FastAPI service encapsulates AI capabilities and agent workflows,
- MongoDB stores all operational state,
- Exotel and AWS Connect extend transaction verification,
- and AWS ECS Fargate provides the target production deployment model.
