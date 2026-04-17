FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
Special Requirements — AI Banking Platform
Models / LLMs:

Amazon Bedrock — Claude 3 Sonnet (anthropic.claude-3-sonnet-20240229-v1:0) as primary LLM
OpenAI GPT as fallback
Compute:

AWS ECS Fargate (3 containers: Node.js backend, Py