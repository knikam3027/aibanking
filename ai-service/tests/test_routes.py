"""
Tests for FastAPI routes — Agent endpoints and direct service endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthEndpoint:

    def test_root_health(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"
        assert data["framework"] == "Amazon Bedrock AgentCore"


class TestDirectEndpoints:
    """Test the original direct service endpoints (backward compatible)."""

    def test_fraud_check(self, client):
        response = client.post("/fraud-check", json={
            "amount": 500,
            "balance": 50000,
            "recent_transactions": [],
        })
        assert response.status_code == 200
        data = response.json()
        assert "is_fraud" in data
        assert "risk_score" in data

    def test_insights(self, client):
        response = client.post("/insights", json={
            "balance": 50000,
            "transactions": [
                {"amount": 500, "type": "debit", "category": "Food"},
                {"amount": 10000, "type": "credit"},
            ],
        })
        assert response.status_code == 200
        assert "financialHealthScore" in response.json()

    def test_loan_score(self, client):
        response = client.post("/loan-score", json={
            "amount": 50000,
            "balance": 100000,
            "transactions": [],
        })
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "status" in data

    def test_predict_expense(self, client):
        response = client.post("/predict-expense", json={
            "balance": 50000,
            "transactions": [{"amount": 500, "type": "debit"}],
        })
        assert response.status_code == 200
        assert "predicted_weekly_expense" in response.json()


class TestAgentEndpoints:
    """Test the multi-agent orchestrated endpoints."""

    def test_agent_status(self, client):
        response = client.get("/agents/status")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 8
        assert "routing_table" in data

    def test_agent_health(self, client):
        response = client.get("/agents/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["orchestration"] == "supervisor_worker_pattern"
        assert data["framework"] == "amazon_bedrock_agentcore"

    def test_agent_fraud_check(self, client):
        response = client.post("/agents/fraud-check", json={
            "amount": 1000,
            "balance": 50000,
            "recent_transactions": [],
        })
        assert response.status_code == 200
        data = response.json()
        assert data["result"]["risk_score"] >= 0
        assert "trace" in data
        assert "fraud_detector" in data["trace"]["agents_invoked"]

    def test_agent_insights(self, client):
        response = client.post("/agents/insights", json={
            "balance": 50000,
            "transactions": [
                {"amount": 500, "type": "debit", "category": "Food"},
            ],
        })
        assert response.status_code == 200
        assert "financialHealthScore" in response.json()["result"]

    def test_agent_loan_score(self, client):
        response = client.post("/agents/loan-score", json={
            "amount": 50000,
            "balance": 100000,
            "transactions": [],
        })
        assert response.status_code == 200
        assert response.json()["result"]["status"] in ["approved", "review", "rejected"]

    def test_agent_predict(self, client):
        response = client.post("/agents/predict", json={
            "balance": 50000,
            "transactions": [{"amount": 500, "type": "debit"}],
        })
        assert response.status_code == 200
        assert "predicted_weekly_expense" in response.json()["result"]

    def test_agent_transfer_risk_multi_agent(self, client):
        """Tests multi-agent pipeline: Fraud + Insights."""
        response = client.post("/agents/transfer-risk", json={
            "amount": 5000,
            "balance": 100000,
            "recent_transactions": [
                {"amount": 1000, "type": "debit", "category": "Food"},
            ],
        })
        assert response.status_code == 200
        trace = response.json()["trace"]
        assert "fraud_detector" in trace["agents_invoked"]
        assert "insights_analyst" in trace["agents_invoked"]

    def test_agent_chat_guardrails_block(self, client):
        """Chat with profanity should be blocked by guardrails agent."""
        response = client.post("/agents/chat", json={
            "message": "fuck this",
            "balance": 10000,
            "transactions": [],
            "chatHistory": [],
        })
        assert response.status_code == 200
        data = response.json()
        assert data["blocked"] is True
