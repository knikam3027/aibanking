"""
Amazon Bedrock LLM Client — Primary AI provider for the banking platform.
Uses Claude 3 Sonnet via Amazon Bedrock, with OpenAI fallback.
"""

import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded clients
_bedrock_client = None
_openai_client = None


def _get_bedrock_client():
    """Initialize Bedrock runtime client (lazy singleton)."""
    global _bedrock_client
    if _bedrock_client is None:
        try:
            import boto3
            _bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=os.getenv("AWS_REGION", "us-west-2"),
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            logger.info("Amazon Bedrock runtime client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Bedrock client: {e}")
            _bedrock_client = None
    return _bedrock_client


def _get_openai_client():
    """Initialize OpenAI client as fallback (lazy singleton)."""
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                _openai_client = OpenAI(api_key=api_key)
                logger.info("OpenAI fallback client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI client: {e}")
    return _openai_client


def invoke_llm(
    prompt: str,
    system_prompt: str = "You are an AI banking assistant.",
    max_tokens: int = 1024,
    temperature: float = 0.7,
    model_id: Optional[str] = None,
) -> str:
    """
    Invoke LLM with Bedrock (primary) → OpenAI (fallback) strategy.
    
    Args:
        prompt: User message / prompt text
        system_prompt: System-level instruction
        max_tokens: Maximum response tokens
        temperature: Sampling temperature
        model_id: Override Bedrock model ID
    
    Returns:
        Generated text response
    """
    # Try Amazon Bedrock first
    bedrock_response = _invoke_bedrock(prompt, system_prompt, max_tokens, temperature, model_id)
    if bedrock_response:
        return bedrock_response

    # Fallback to OpenAI
    openai_response = _invoke_openai(prompt, system_prompt, max_tokens, temperature)
    if openai_response:
        return openai_response

    return "I'm experiencing technical difficulties. Please try again shortly."


def _invoke_bedrock(
    prompt: str,
    system_prompt: str,
    max_tokens: int,
    temperature: float,
    model_id: Optional[str] = None,
) -> Optional[str]:
    """Call Amazon Bedrock Claude model."""
    client = _get_bedrock_client()
    if not client:
        return None

    model = model_id or os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")

    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": prompt}
            ],
        })

        response = client.invoke_model(
            modelId=model,
            contentType="application/json",
            accept="application/json",
            body=body,
        )

        result = json.loads(response["body"].read())
        text = result.get("content", [{}])[0].get("text", "")
        logger.info(f"Bedrock response received (model={model}, tokens={result.get('usage', {}).get('output_tokens', 'N/A')})")
        return text

    except Exception as e:
        logger.warning(f"Bedrock invocation failed: {e}")
        return None


def _invoke_openai(
    prompt: str,
    system_prompt: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """Call OpenAI as fallback."""
    client = _get_openai_client()
    if not client:
        return None

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        text = response.choices[0].message.content
        logger.info("OpenAI fallback response received")
        return text

    except Exception as e:
        logger.warning(f"OpenAI invocation failed: {e}")
        return None


def get_provider_status() -> dict:
    """Check which LLM providers are available."""
    bedrock_ok = _get_bedrock_client() is not None
    openai_ok = _get_openai_client() is not None
    return {
        "bedrock": {"available": bedrock_ok, "model": os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")},
        "openai": {"available": openai_ok, "model": "gpt-4o-mini"},
        "primary": "bedrock" if bedrock_ok else ("openai" if openai_ok else "none"),
    }
