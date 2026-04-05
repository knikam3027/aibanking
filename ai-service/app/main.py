import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat, fraud, insights, loan, prediction, payroll

app = FastAPI(title="AI Banking Service", version="1.0.0")

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


@app.get("/")
def health():
    return {"status": "ok", "service": "AI Banking Service"}
