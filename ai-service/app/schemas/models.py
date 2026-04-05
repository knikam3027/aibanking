from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TransactionItem(BaseModel):
    amount: float
    type: str
    category: Optional[str] = "General"
    receiver: Optional[str] = None
    sender: Optional[str] = None
    createdAt: Optional[str] = None
    status: Optional[str] = "success"


class ChatHistoryItem(BaseModel):
    role: str
    message: str


class ChatRequest(BaseModel):
    message: str
    balance: float = 0
    transactions: List[TransactionItem] = []
    chatHistory: List[ChatHistoryItem] = []


class ChatResponse(BaseModel):
    reply: str


class FraudCheckRequest(BaseModel):
    amount: float
    balance: float = 0
    recent_transactions: List[TransactionItem] = []


class FraudCheckResponse(BaseModel):
    is_fraud: bool
    risk_score: float
    reason: str


class InsightsRequest(BaseModel):
    balance: float = 0
    transactions: List[TransactionItem] = []


class InsightsResponse(BaseModel):
    financialHealthScore: int
    monthlySummary: str
    prediction: str
    spendingBreakdown: dict
    savingsRate: float
    totalSpent: float
    totalIncome: float


class LoanScoreRequest(BaseModel):
    amount: float
    balance: float = 0
    transactions: List[TransactionItem] = []


class LoanScoreResponse(BaseModel):
    score: int
    status: str
    interest_rate: float
    reason: str


class PredictionRequest(BaseModel):
    balance: float = 0
    transactions: List[TransactionItem] = []


class PredictionResponse(BaseModel):
    predicted_weekly_expense: float
    days_until_low_balance: int
    warning: str
    avg_daily_spending: float
    current_balance: float
