# AI-Powered Smart Banking System

A next-generation banking system combining traditional banking with AI-powered services including smart assistance, fraud detection, spending insights, predictive analysis, and automated loan decisions.

## Architecture

```
React Frontend  →  Node.js Backend  →  MongoDB
                        ↓
               Python AI Service (FastAPI)
```

## Tech Stack

- **Frontend**: React.js, Tailwind CSS, React Router, Axios, Recharts
- **Backend**: Node.js, Express.js, JWT Authentication, Mongoose
- **AI Service**: Python, FastAPI
- **Database**: MongoDB

## Setup & Run

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB running on `localhost:27017`

### 1. Backend
```bash
cd server
npm install
npm run dev
```
Runs on `http://localhost:5000`

### 2. AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Runs on `http://localhost:8000`

### 3. Frontend
```bash
cd client
npm install
npm run dev
```
Runs on `http://localhost:5173` (proxies API to backend)

## Features

1. **User Auth** - Register/Login with JWT
2. **Dashboard** - Account balance, recent transactions, AI predictions
3. **Transactions** - Full history with filtering
4. **Money Transfer** - With real-time AI fraud detection
5. **AI Chatbot** - Ask about balance, spending, savings tips
6. **Spending Insights** - Health score, spending breakdown, predictions
7. **Loan Eligibility** - AI-based credit scoring and loan approval
8. **Alerts** - Fraud warnings and notifications

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Banking
- `GET /api/account/details`
- `GET /api/transactions`
- `POST /api/transactions/transfer`

### AI
- `POST /api/ai/chat`
- `GET /api/ai/insights`
- `GET /api/ai/predict-balance`

### Loans
- `POST /api/loans/check-eligibility`
- `POST /api/loans/apply`
