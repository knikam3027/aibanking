"""
Agent Orchestration Routes — Exposes the multi-agent system via REST API.
Provides both agent-orchestrated endpoints and agent status/observability.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Any
from app.schemas.models import TransactionItem, ChatHistoryItem
from app.services.agent_orchestrator import get_supervisor

router = APIRouter(prefix="/agents", tags=["Agent Orchestration"])


# ─── Request Models ────────────────────────────────────────────────────

class AgentChatRequest(BaseModel):
    message: str
    balance: float = 0
    transactions: List[TransactionItem] = []
    chatHistory: List[ChatHistoryItem] = []


class AgentFraudRequest(BaseModel):
    amount: float
    balance: float = 0
    recent_transactions: List[TransactionItem] = []


class AgentInsightsRequest(BaseModel):
    balance: float = 0
    transactions: List[TransactionItem] = []


class AgentLoanRequest(BaseModel):
    amount: float
    balance: float = 0
    transactions: List[TransactionItem] = []


class AgentPredictionRequest(BaseModel):
    balance: float = 0
    transactions: List[TransactionItem] = []


class AgentResponse(BaseModel):
    result: Optional[Any] = None
    blocked: bool = False
    reason: Optional[str] = None
    category: Optional[str] = None
    trace: Optional[dict] = None
    shared_memory_keys: Optional[list] = None
    error: Optional[str] = None


# ─── Agent-Orchestrated Endpoints ──────────────────────────────────────

@router.post("/chat", response_model=AgentResponse)
def agent_chat(req: AgentChatRequest):
    """Multi-agent orchestrated chat: Guardrails → RAG → ChatAgent."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("chat", {
        "message": req.message,
        "balance": req.balance,
        "transactions": [t.model_dump() for t in req.transactions],
        "chatHistory": [h.model_dump() for h in req.chatHistory],
    })
    return AgentResponse(**result)


@router.post("/fraud-check", response_model=AgentResponse)
def agent_fraud_check(req: AgentFraudRequest):
    """Single-agent fraud detection with tracing."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("fraud_check", {
        "amount": req.amount,
        "balance": req.balance,
        "recent_transactions": [t.model_dump() for t in req.recent_transactions],
    })
    return AgentResponse(**result)


@router.post("/insights", response_model=AgentResponse)
def agent_insights(req: AgentInsightsRequest):
    """Single-agent financial insights generation."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("insights", {
        "balance": req.balance,
        "transactions": [t.model_dump() for t in req.transactions],
    })
    return AgentResponse(**result)


@router.post("/loan-score", response_model=AgentResponse)
def agent_loan_score(req: AgentLoanRequest):
    """Single-agent loan eligibility scoring."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("loan_score", {
        "amount": req.amount,
        "balance": req.balance,
        "transactions": [t.model_dump() for t in req.transactions],
    })
    return AgentResponse(**result)


@router.post("/predict", response_model=AgentResponse)
def agent_predict(req: AgentPredictionRequest):
    """Single-agent cash flow prediction."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("predict", {
        "balance": req.balance,
        "transactions": [t.model_dump() for t in req.transactions],
    })
    return AgentResponse(**result)


@router.post("/transfer-risk", response_model=AgentResponse)
def agent_transfer_risk(req: AgentFraudRequest):
    """Multi-agent transfer risk: Fraud + Insights (parallel evaluation)."""
    supervisor = get_supervisor()
    result = supervisor.orchestrate("transfer_with_fraud", {
        "amount": req.amount,
        "balance": req.balance,
        "recent_transactions": [t.model_dump() for t in req.recent_transactions],
        "transactions": [t.model_dump() for t in req.recent_transactions],
    })
    return AgentResponse(**result)


# ─── Agent Observability ───────────────────────────────────────────────

@router.get("/status")
def agent_status():
    """Get status of all registered agents and routing table."""
    supervisor = get_supervisor()
    return supervisor.get_agent_status()


@router.get("/health")
def agent_health():
    """Health check for the agent orchestration layer."""
    from app.services.bedrock_client import get_provider_status
    supervisor = get_supervisor()
    status = supervisor.get_agent_status()
    llm_status = get_provider_status()
    return {
        "status": "healthy",
        "agent_count": len(status["agents"]),
        "agents": status["agents"],
        "llm_providers": llm_status,
        "orchestration": "supervisor_worker_pattern",
        "framework": "amazon_bedrock_agentcore",
    }
