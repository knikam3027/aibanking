#!/bin/bash
# deploy.sh — Deploy AI Banking Platform to AWS ECS Fargate
# Usage: ./deploy.sh [environment] [region]
# Example: ./deploy.sh production us-west-2

set -euo pipefail

ENVIRONMENT="${1:-production}"
REGION="${2:-us-west-2}"
STACK_NAME="${ENVIRONMENT}-banking-platform"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "═══════════════════════════════════════════════════════"
echo "  AI Banking Platform — AWS Deployment"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region: ${REGION}"
echo "  Account: ${AWS_ACCOUNT_ID}"
echo "═══════════════════════════════════════════════════════"

# Step 1: Deploy CloudFormation Stack
echo ""
echo "▶ Step 1: Deploying CloudFormation infrastructure..."
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yaml \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides \
    EnvironmentName="${ENVIRONMENT}" \
    MongoDBUri="${MONGODB_URI}" \
    JWTSecret="${JWT_SECRET}" \
    OpenAIApiKey="${OPENAI_API_KEY}" \
  --capabilities CAPABILITY_IAM \
  --region "${REGION}" \
  --no-fail-on-empty-changeset

echo "✅ Infrastructure deployed"

# Step 2: Login to ECR
echo ""
echo "▶ Step 2: Authenticating with ECR..."
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Step 3: Build & Push Docker Images
echo ""
echo "▶ Step 3: Building and pushing Docker images..."

# Server
echo "  Building server image..."
docker build -t "${ENVIRONMENT}-banking-server" ./server
docker tag "${ENVIRONMENT}-banking-server:latest" \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-server:latest"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-server:latest"

# AI Service
echo "  Building AI service image..."
docker build -t "${ENVIRONMENT}-banking-ai" ./ai-service
docker tag "${ENVIRONMENT}-banking-ai:latest" \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-ai:latest"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-ai:latest"

# Client
echo "  Building client image..."
docker build -t "${ENVIRONMENT}-banking-client" ./client
docker tag "${ENVIRONMENT}-banking-client:latest" \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-client:latest"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENVIRONMENT}-banking-client:latest"

echo "✅ All images pushed to ECR"

# Step 4: Update ECS Services
echo ""
echo "▶ Step 4: Updating ECS services..."
CLUSTER="${ENVIRONMENT}-banking-cluster"

aws ecs update-service --cluster "${CLUSTER}" --service banking-ai-service --force-new-deployment --region "${REGION}"
aws ecs update-service --cluster "${CLUSTER}" --service banking-server --force-new-deployment --region "${REGION}"
aws ecs update-service --cluster "${CLUSTER}" --service banking-client --force-new-deployment --region "${REGION}"

echo "✅ ECS services updated"

# Step 5: Get outputs
echo ""
echo "▶ Step 5: Getting deployment URL..."
ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ALBURL'].OutputValue" \
  --output text \
  --region "${REGION}")

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "  Application URL: ${ALB_URL}"
echo "  Agent Status:    ${ALB_URL}/ai/agents/health"
echo "═══════════════════════════════════════════════════════"
