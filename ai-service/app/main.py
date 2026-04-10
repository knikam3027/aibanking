import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat, fraud, insights, loan, prediction, payroll
from app.routes import agents as agent_routes

app = FastAPI(
    title="AI Banking Service",
    version="2.0.0",
    description="Multi-Agent AI Banking Platform powered by Amazon Bedrock AgentCore",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, tags=["Chat"])
app.include_router(fraud.router, tags=["Fraud Detection"])
app.include_router(insights.router, tags=["Insights"])
app.include_router(loan.router, tags=["Loan Scoring"])
app.include_router(prediction.router, tags=["Prediction"])
app.include_router(payroll.router, tags=["Payroll"])
app.include_router(agent_routes.router)


@app.get("/")
def health():
    from app.services.bedrock_client import get_provider_status
    return {
        "status": "ok",
        "service": "AI Banking Service",
        "version": "2.0.0",
        "framework": "Amazon Bedrock AgentCore",
        "orchestration": "supervisor_worker_pattern",
        "llm_providers": get_provider_status(),
    }
