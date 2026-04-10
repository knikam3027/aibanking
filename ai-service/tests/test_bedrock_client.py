"""
Tests for the Amazon Bedrock LLM client — provider detection and fallback logic.
"""

import pytest
from unittest.mock import patch, MagicMock
from app.services.bedrock_client import invoke_llm, get_provider_status


class TestBedrockClient:

    def test_get_provider_status(self):
        """Provider status should report availability."""
        status = get_provider_status()
        assert "bedrock" in status
        assert "openai" in status
        assert "primary" in status
        assert status["primary"] in ["bedrock", "openai", "none"]

    @patch("app.services.bedrock_client._get_bedrock_client")
    @patch("app.services.bedrock_client._get_openai_client")
    def test_fallback_to_openai(self, mock_openai, mock_bedrock):
        """Should fall back to OpenAI when Bedrock is unavailable."""
        mock_bedrock.return_value = None

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        result = invoke_llm("Hello")
        assert result == "Test response"

    @patch("app.services.bedrock_client._get_bedrock_client")
    @patch("app.services.bedrock_client._get_openai_client")
    def test_all_providers_fail(self, mock_openai, mock_bedrock):
        """Should return error message when all providers fail."""
        mock_bedrock.return_value = None
        mock_openai.return_value = None

        result = invoke_llm("Hello")
        assert "technical difficulties" in result.lower()

    def test_bedrock_model_default(self):
        """Default model should be Claude 3 Sonnet."""
        status = get_provider_status()
        assert "claude" in status["bedrock"]["model"].lower()
