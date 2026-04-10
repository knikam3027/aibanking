# KIRO Steering Rules — AI Banking Platform
# These rules guide Amazon Q / KIRO during development

## Architecture Principles
- Always use Amazon Bedrock as the primary LLM provider
- Implement fallback pattern: Bedrock → OpenAI for resilience
- Follow supervisor/worker agent pattern from Bedrock AgentCore
- Every agent invocation must produce an AgentTrace for observability
- Apply guardrails agent before all user-facing AI operations

## Code Quality
- All Python code must use type hints
- All API endpoints must use Pydantic model validation
- Services must be stateless — use SharedMemory for cross-agent context
- Error handling: catch and log, never crash the supervisor

## Security
- Never expose API keys in responses
- Validate all user input through guardrails before AI processing
- Block prompt injection, profanity, hate speech, and financial abuse
- Use context-aware filtering (e.g., "fraud check" is allowed, "commit fraud" is not)

## AWS Integration
- Use boto3 for all AWS service calls
- IAM roles should follow least-privilege principle
- All ECS tasks must log to CloudWatch
- ECR images must have scan-on-push enabled

## Testing
- Every new agent must have corresponding test cases
- Test both success and failure paths
- Test guardrails blocking and pass-through scenarios
- Use pytest with FastAPI TestClient for integration tests
