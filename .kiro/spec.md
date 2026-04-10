# KIRO Spec — Multi-Agent AI Banking Platform

## Overview
An AI-powered banking platform using Amazon Bedrock AgentCore for multi-agent orchestration.

## Agents
- **Supervisor**: Routes requests to specialized agents, manages shared memory
- **GuardrailsAgent**: Content moderation (profanity, injection, abuse)
- **RAGAgent**: Knowledge retrieval (16 banking topics, TF-IDF)
- **ChatAgent**: 40+ intent recognition, bilingual (English/Hindi)
- **FraudAgent**: Real-time risk scoring (0-100, 5 factors)
- **InsightsAgent**: Financial health scoring, spending analysis
- **LoanAgent**: Credit scoring, eligibility assessment
- **PredictionAgent**: Cash flow forecasting
- **PayrollAgent**: PDF parsing, salary processing

## LLM Strategy
- Primary: Amazon Bedrock (Claude 3 Sonnet)
- Fallback: OpenAI GPT-4o-mini
- Automatic provider detection and failover

## Infrastructure
- AWS ECS Fargate (3 services)
- Application Load Balancer (path-based routing)
- Amazon ECR (scan-on-push)
- CloudWatch (Container Insights)
- CloudFormation IaC

## Pipelines
- Sequential: Guardrails → RAG → Chat
- Multi-agent: Fraud + Insights (transfer risk)
- Single: Loan, Prediction, Payroll
