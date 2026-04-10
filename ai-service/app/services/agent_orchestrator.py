"""
Amazon Bedrock AgentCore — Multi-Agent Orchestration Layer

Implements a Supervisor/Worker agent pattern where:
- AgentSupervisor: Routes tasks, delegates to specialized worker agents, aggregates results
- Worker Agents: FraudAgent, ChatAgent, InsightsAgent, LoanAgent, PredictionAgent, PayrollAgent
- Shared Memory: Cross-agent context for correlated decision-making
- Observability: Full trace logging for every agent invocation

This module provides the agentic AI backbone for the banking platform,
coordinating multiple specialized AI agents through Amazon Bedrock AgentCore patterns.
"""

import time
import uuid
import logging
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# ─── Agent Definitions ────────────────────────────────────────────────

class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    FRAUD_DETECTOR = "fraud_detector"
    CHAT_ASSISTANT = "chat_assistant"
    INSIGHTS_ANALYST = "insights_analyst"
    LOAN_SCORER = "loan_scorer"
    PREDICTION_ENGINE = "prediction_engine"
    PAYROLL_PROCESSOR = "payroll_processor"
    GUARDRAILS = "guardrails"
    RAG_RETRIEVER = "rag_retriever"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    DELEGATED = "delegated"


@dataclass
class AgentTask:
    """A unit of work assigned to a worker agent."""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    task_type: str = ""
    payload: dict = field(default_factory=dict)
    assigned_agent: AgentRole = AgentRole.SUPERVISOR
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    parent_task_id: Optional[str] = None

    @property
    def duration_ms(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return round((self.completed_at - self.started_at) * 1000, 2)
        return None


@dataclass
class AgentTrace:
    """Observability trace for agent execution."""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tasks: list = field(default_factory=list)
    total_duration_ms: float = 0
    agents_invoked: list = field(default_factory=list)
    supervisor_decisions: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "total_duration_ms": self.total_duration_ms,
            "agents_invoked": self.agents_invoked,
            "supervisor_decisions": self.supervisor_decisions,
            "task_count": len(self.tasks),
            "tasks": [
                {
                    "task_id": t.task_id,
                    "type": t.task_type,
                    "agent": t.assigned_agent.value,
                    "status": t.status.value,
                    "duration_ms": t.duration_ms,
                    "error": t.error,
                }
                for t in self.tasks
            ],
        }


# ─── Shared Memory ────────────────────────────────────────────────────

class AgentSharedMemory:
    """
    Cross-agent shared memory store (Amazon Bedrock AgentCore pattern).
    Allows agents to share context — e.g., fraud agent's risk score informs chat agent's response.
    """

    def __init__(self):
        self._store: dict[str, Any] = {}
        self._history: list[dict] = []

    def put(self, key: str, value: Any, agent: AgentRole):
        self._store[key] = value
        self._history.append({
            "action": "put",
            "key": key,
            "agent": agent.value,
            "timestamp": time.time(),
        })
        logger.debug(f"SharedMemory: {agent.value} stored '{key}'")

    def get(self, key: str, default: Any = None) -> Any:
        return self._store.get(key, default)

    def get_all(self) -> dict:
        return dict(self._store)

    def clear(self):
        self._store.clear()
        self._history.clear()

    def get_history(self) -> list:
        return list(self._history)


# ─── Worker Agents ─────────────────────────────────────────────────────

class BaseAgent:
    """Base class for all worker agents."""

    role: AgentRole = AgentRole.SUPERVISOR

    def __init__(self, shared_memory: AgentSharedMemory):
        self.shared_memory = shared_memory

    def execute(self, task: AgentTask) -> Any:
        raise NotImplementedError


class GuardrailsAgent(BaseAgent):
    """Safety & content moderation agent — runs BEFORE all other agents."""
    role = AgentRole.GUARDRAILS

    def execute(self, task: AgentTask) -> dict:
        from app.services.guardrails import check_guardrails, sanitize_message
        message = task.payload.get("message", "")
        sanitized = sanitize_message(message)
        result = check_guardrails(sanitized)
        self.shared_memory.put("guardrails_result", result, self.role)
        self.shared_memory.put("sanitized_message", sanitized, self.role)
        return result


class RAGAgent(BaseAgent):
    """Knowledge retrieval agent using TF-IDF RAG pipeline."""
    role = AgentRole.RAG_RETRIEVER

    def execute(self, task: AgentTask) -> dict:
        from app.services.rag_service import get_relevant_knowledge
        query = task.payload.get("query", "")
        knowledge = get_relevant_knowledge(query)
        self.shared_memory.put("rag_context", knowledge, self.role)
        return {"knowledge": knowledge, "query": query}


class FraudAgent(BaseAgent):
    """Real-time fraud detection agent — scores transaction risk (0-100)."""
    role = AgentRole.FRAUD_DETECTOR

    def execute(self, task: AgentTask) -> dict:
        from app.services.fraud_service import check_fraud
        from app.schemas.models import TransactionItem
        amount = task.payload.get("amount", 0)
        balance = task.payload.get("balance", 0)
        raw_txns = task.payload.get("recent_transactions", [])
        transactions = [TransactionItem(**t) if isinstance(t, dict) else t for t in raw_txns]
        result = check_fraud(amount, balance, transactions)
        self.shared_memory.put("fraud_result", result, self.role)
        self.shared_memory.put("risk_score", result["risk_score"], self.role)
        return result


class ChatAgent(BaseAgent):
    """Conversational AI agent — handles 40+ banking intents."""
    role = AgentRole.CHAT_ASSISTANT

    def execute(self, task: AgentTask) -> dict:
        from app.services.chat_service import analyze_chat
        message = self.shared_memory.get("sanitized_message", task.payload.get("message", ""))
        balance = task.payload.get("balance", 0)
        transactions = task.payload.get("transactions", [])
        chat_history = task.payload.get("chatHistory", [])

        # Inject RAG context if available
        rag_context = self.shared_memory.get("rag_context")
        fraud_context = self.shared_memory.get("fraud_result")

        reply = analyze_chat(message, balance, transactions, chat_history)

        self.shared_memory.put("chat_reply", reply, self.role)
        return {"reply": reply}


class InsightsAgent(BaseAgent):
    """Financial analytics agent — health scoring, spending breakdown."""
    role = AgentRole.INSIGHTS_ANALYST

    def execute(self, task: AgentTask) -> dict:
        from app.services.insights_service import generate_insights
        from app.schemas.models import TransactionItem
        balance = task.payload.get("balance", 0)
        raw_txns = task.payload.get("transactions", [])
        transactions = [TransactionItem(**t) if isinstance(t, dict) else t for t in raw_txns]
        result = generate_insights(balance, transactions)
        self.shared_memory.put("insights_result", result, self.role)
        return result


class LoanAgent(BaseAgent):
    """Loan eligibility & credit scoring agent."""
    role = AgentRole.LOAN_SCORER

    def execute(self, task: AgentTask) -> dict:
        from app.services.loan_service import calculate_loan_score
        from app.schemas.models import TransactionItem
        amount = task.payload.get("amount", 0)
        balance = task.payload.get("balance", 0)
        raw_txns = task.payload.get("transactions", [])
        transactions = [TransactionItem(**t) if isinstance(t, dict) else t for t in raw_txns]
        result = calculate_loan_score(amount, balance, transactions)
        self.shared_memory.put("loan_result", result, self.role)
        return result


class PredictionAgent(BaseAgent):
    """Cash flow prediction & balance forecasting agent."""
    role = AgentRole.PREDICTION_ENGINE

    def execute(self, task: AgentTask) -> dict:
        from app.services.prediction_service import predict_expenses
        from app.schemas.models import TransactionItem
        balance = task.payload.get("balance", 0)
        raw_txns = task.payload.get("transactions", [])
        transactions = [TransactionItem(**t) if isinstance(t, dict) else t for t in raw_txns]
        result = predict_expenses(balance, transactions)
        self.shared_memory.put("prediction_result", result, self.role)
        return result


class PayrollAgent(BaseAgent):
    """Salary PDF parsing & payroll processing agent."""
    role = AgentRole.PAYROLL_PROCESSOR

    def execute(self, task: AgentTask) -> dict:
        from app.services.pdf_service import parse_salary_pdf
        file_path = task.payload.get("file_path", "")
        result = parse_salary_pdf(file_path)
        self.shared_memory.put("payroll_result", result, self.role)
        return result


# ─── Agent Registry ────────────────────────────────────────────────────

AGENT_REGISTRY: dict[AgentRole, type[BaseAgent]] = {
    AgentRole.GUARDRAILS: GuardrailsAgent,
    AgentRole.RAG_RETRIEVER: RAGAgent,
    AgentRole.FRAUD_DETECTOR: FraudAgent,
    AgentRole.CHAT_ASSISTANT: ChatAgent,
    AgentRole.INSIGHTS_ANALYST: InsightsAgent,
    AgentRole.LOAN_SCORER: LoanAgent,
    AgentRole.PREDICTION_ENGINE: PredictionAgent,
    AgentRole.PAYROLL_PROCESSOR: PayrollAgent,
}


# ─── Supervisor Agent ──────────────────────────────────────────────────

class AgentSupervisor:
    """
    Supervisor Agent — Amazon Bedrock AgentCore orchestration pattern.
    
    Routes incoming requests to specialized worker agents, manages task lifecycle,
    implements error handling with fallback strategies, and maintains shared memory
    for cross-agent context.
    
    Orchestration patterns:
    1. Sequential: Guardrails → RAG → Chat (for chat requests)
    2. Parallel: Fraud + Insights (for transfer requests)
    3. Single: Loan/Prediction/Payroll (for specific queries)
    """

    # Maps request types to agent execution pipelines
    ROUTING_TABLE = {
        "chat": [AgentRole.GUARDRAILS, AgentRole.RAG_RETRIEVER, AgentRole.CHAT_ASSISTANT],
        "fraud_check": [AgentRole.FRAUD_DETECTOR],
        "insights": [AgentRole.INSIGHTS_ANALYST],
        "loan_score": [AgentRole.LOAN_SCORER],
        "predict": [AgentRole.PREDICTION_ENGINE],
        "payroll": [AgentRole.PAYROLL_PROCESSOR],
        "transfer_with_fraud": [AgentRole.FRAUD_DETECTOR, AgentRole.INSIGHTS_ANALYST],
    }

    def __init__(self):
        self.shared_memory = AgentSharedMemory()
        self.agents: dict[AgentRole, BaseAgent] = {}
        self._initialize_agents()

    def _initialize_agents(self):
        """Instantiate all worker agents with shared memory."""
        for role, agent_class in AGENT_REGISTRY.items():
            self.agents[role] = agent_class(self.shared_memory)
            logger.info(f"Initialized agent: {role.value}")

    def orchestrate(self, request_type: str, payload: dict) -> dict:
        """
        Main orchestration entry point.
        Routes to appropriate agent pipeline based on request type.
        
        Args:
            request_type: One of the keys in ROUTING_TABLE
            payload: Request data to pass to agents
            
        Returns:
            Dict with result, trace, and metadata
        """
        trace = AgentTrace()
        start_time = time.time()

        pipeline = self.ROUTING_TABLE.get(request_type, [])
        if not pipeline:
            return {
                "error": f"Unknown request type: {request_type}",
                "trace": trace.to_dict(),
            }

        decision = {
            "request_type": request_type,
            "pipeline": [r.value for r in pipeline],
            "timestamp": time.time(),
        }
        trace.supervisor_decisions.append(decision)
        logger.info(f"Supervisor routing '{request_type}' → {[r.value for r in pipeline]}")

        # Reset shared memory for new request
        self.shared_memory.clear()
        self.shared_memory.put("request_type", request_type, AgentRole.SUPERVISOR)

        last_result = None

        for agent_role in pipeline:
            task = AgentTask(
                task_type=request_type,
                payload=payload,
                assigned_agent=agent_role,
            )

            result = self._execute_agent(agent_role, task, trace)

            # Short-circuit on guardrails block
            if agent_role == AgentRole.GUARDRAILS and result and result.get("blocked"):
                trace.total_duration_ms = round((time.time() - start_time) * 1000, 2)
                return {
                    "blocked": True,
                    "reason": result.get("reason", "Blocked by guardrails"),
                    "category": result.get("category", "unknown"),
                    "trace": trace.to_dict(),
                }

            last_result = result

        trace.total_duration_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "result": last_result,
            "trace": trace.to_dict(),
            "shared_memory_keys": list(self.shared_memory.get_all().keys()),
        }

    def _execute_agent(self, role: AgentRole, task: AgentTask, trace: AgentTrace) -> Any:
        """Execute a single agent with error handling and tracing."""
        agent = self.agents.get(role)
        if not agent:
            task.status = TaskStatus.FAILED
            task.error = f"Agent not found: {role.value}"
            trace.tasks.append(task)
            return None

        task.status = TaskStatus.IN_PROGRESS
        task.started_at = time.time()
        trace.agents_invoked.append(role.value)

        try:
            result = agent.execute(task)
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = time.time()
            logger.info(f"Agent {role.value} completed in {task.duration_ms}ms")
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = time.time()
            logger.error(f"Agent {role.value} failed: {e}")
            result = None

        trace.tasks.append(task)
        return result

    def get_agent_status(self) -> dict:
        """Return status of all registered agents."""
        return {
            "agents": [
                {
                    "role": role.value,
                    "type": agent.__class__.__name__,
                    "active": True,
                }
                for role, agent in self.agents.items()
            ],
            "routing_table": {
                k: [r.value for r in v]
                for k, v in self.ROUTING_TABLE.items()
            },
            "shared_memory_keys": list(self.shared_memory.get_all().keys()),
        }


# ─── Singleton Supervisor ──────────────────────────────────────────────

_supervisor: Optional[AgentSupervisor] = None


def get_supervisor() -> AgentSupervisor:
    """Get or create the global AgentSupervisor instance."""
    global _supervisor
    if _supervisor is None:
        _supervisor = AgentSupervisor()
        logger.info("AgentSupervisor initialized with all worker agents")
    return _supervisor
