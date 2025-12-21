#!/usr/bin/env python3
"""
LLM Client - Unified interface for Gemini and OpenAI.

Supports:
- Google Gemini (free tier: 15 RPM, 1M tokens/day)
- OpenAI GPT-4/GPT-3.5 (paid)
"""

import os
import json
from abc import ABC, abstractmethod
from typing import Dict, Optional, Any
from dataclasses import dataclass


@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str
    model: str
    usage: Optional[Dict] = None
    raw_response: Optional[Any] = None


class LLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        """Generate a response from the LLM."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM client is available (API key set, etc.)."""
        pass


class GeminiClient(LLMClient):
    """Google Gemini client (free tier available)."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-1.5-flash"):
        """
        Initialize Gemini client.
        
        Args:
            api_key: Gemini API key (or set GEMINI_API_KEY env var)
            model: Model to use (gemini-1.5-flash is free tier)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        self._client = None
    
    def _get_client(self):
        """Lazy load Gemini client."""
        if self._client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel(self.model)
            except ImportError:
                raise ImportError(
                    "google-generativeai not installed. Run: pip install google-generativeai"
                )
        return self._client
    
    def is_available(self) -> bool:
        """Check if Gemini is available."""
        return bool(self.api_key)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        """Generate response from Gemini."""
        client = self._get_client()
        
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        response = client.generate_content(full_prompt)
        
        return LLMResponse(
            content=response.text,
            model=self.model,
            usage={
                "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else None,
                "completion_tokens": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else None,
            },
            raw_response=response
        )


class OpenAIClient(LLMClient):
    """OpenAI client (GPT-4, GPT-3.5)."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        """
        Initialize OpenAI client.
        
        Args:
            api_key: OpenAI API key (or set OPENAI_API_KEY env var)
            model: Model to use (gpt-4o-mini, gpt-4o, gpt-3.5-turbo)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self._client = None
    
    def _get_client(self):
        """Lazy load OpenAI client."""
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "openai not installed. Run: pip install openai"
                )
        return self._client
    
    def is_available(self) -> bool:
        """Check if OpenAI is available."""
        return bool(self.api_key)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        """Generate response from OpenAI."""
        client = self._get_client()
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=4096,
        )
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=self.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
            raw_response=response
        )


class LLMFactory:
    """Factory for creating LLM clients."""
    
    @staticmethod
    def create(
        provider: str = "auto",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> LLMClient:
        """
        Create an LLM client.
        
        Args:
            provider: "gemini", "openai", or "auto" (try gemini first)
            api_key: API key (optional, uses env vars)
            model: Model name (optional, uses defaults)
        
        Returns:
            LLMClient instance
        """
        if provider == "gemini":
            return GeminiClient(api_key=api_key, model=model or "gemini-1.5-flash")
        
        elif provider == "openai":
            return OpenAIClient(api_key=api_key, model=model or "gpt-4o-mini")
        
        elif provider == "auto":
            # Try Gemini first (free), then OpenAI
            gemini = GeminiClient(api_key=api_key)
            if gemini.is_available():
                return gemini
            
            openai = OpenAIClient(api_key=api_key)
            if openai.is_available():
                return openai
            
            raise ValueError(
                "No LLM API key found. Set GEMINI_API_KEY or OPENAI_API_KEY"
            )
        
        else:
            raise ValueError(f"Unknown provider: {provider}")


# System prompt for workflow generation
WORKFLOW_SYSTEM_PROMPT = """You are an expert Activepieces workflow builder. Your job is to create valid Activepieces workflow JSON based on user descriptions.

CRITICAL RULES:
1. Use ONLY the piece names, action names, and trigger names provided in the context
2. NEVER invent action names - use exactly what's listed
3. Use the exact package names (e.g., @activepieces/piece-gmail)
4. All workflows must have a trigger that starts the flow
5. Use {{variable}} syntax for dynamic values
6. Each step needs: name, type, displayName, valid, settings

OUTPUT FORMAT:
Return ONLY valid JSON in this exact format:
{
  "displayName": "Workflow Name",
  "trigger": {
    "name": "trigger",
    "type": "PIECE_TRIGGER",
    "displayName": "Trigger Display Name",
    "valid": true,
    "settings": {
      "pieceName": "@activepieces/piece-xxx",
      "pieceVersion": "~1.0.0",
      "triggerName": "exact_trigger_name_from_context",
      "input": {},
      "propertySettings": {}
    },
    "nextAction": {
      "name": "step_1",
      "type": "PIECE",
      "displayName": "Action Display Name",
      "valid": true,
      "settings": {
        "pieceName": "@activepieces/piece-xxx",
        "pieceVersion": "~1.0.0",
        "actionName": "exact_action_name_from_context",
        "input": {},
        "propertySettings": {}
      }
    }
  }
}

For conditional logic, use ROUTER:
{
  "name": "router_1",
  "type": "ROUTER",
  "displayName": "Check Condition",
  "valid": true,
  "settings": {
    "executionType": "EXECUTE_FIRST_MATCH",
    "branches": [
      {
        "branchType": "CONDITION",
        "branchName": "If condition",
        "conditions": [[{"firstValue": "{{step.value}}", "operator": "TEXT_CONTAINS", "secondValue": "text"}]]
      },
      {
        "branchType": "FALLBACK",
        "branchName": "Otherwise"
      }
    ]
  },
  "children": [
    { /* first branch action */ },
    { /* fallback action */ }
  ]
}

Valid condition operators: TEXT_CONTAINS, TEXT_EXACTLY_MATCHES, NUMBER_IS_GREATER_THAN, NUMBER_IS_LESS_THAN, BOOLEAN_IS_TRUE, EXISTS, DOES_NOT_EXIST, LIST_IS_EMPTY

REMEMBER: Use ONLY the action/trigger names from the AVAILABLE PIECES section. Do not guess or invent names."""


def main():
    """Test LLM clients."""
    # Test factory
    try:
        client = LLMFactory.create("auto")
        print(f"Using: {client.__class__.__name__}")
        
        response = client.generate(
            "Say hello in JSON format: {\"greeting\": \"...\"}",
            system_prompt="You are a helpful assistant. Return only valid JSON."
        )
        print(f"Response: {response.content}")
        print(f"Usage: {response.usage}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()

