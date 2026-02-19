#!/usr/bin/env python3
"""
LLM Client - Unified interface for multiple LLM providers.

Supports:
- Groq (free tier - Llama 3.1 70B) - RECOMMENDED
- Google Gemini (free tier)
- OpenAI GPT-4/GPT-3.5 (paid)

The LLM produces MINIMAL output - post-processing handles the rest.
"""

import os
import json
from abc import ABC, abstractmethod
from typing import Dict, Optional, Any
from dataclasses import dataclass
from pathlib import Path


def _load_env():
    """Load environment variables from .env file."""
    env_paths = [
        Path(__file__).parent.parent / ".env",
        Path(__file__).parent / ".env",
        Path.cwd() / ".env",
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")
                            if key and value and key not in os.environ:
                                os.environ[key] = value
                print(f"Loaded environment from: {env_path}")
                return
            except Exception as e:
                print(f"Warning: Could not load {env_path}: {e}")

_load_env()


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
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        pass


class GeminiClient(LLMClient):
    """Google Gemini client."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        self._client = None
    
    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client
    
    def is_available(self) -> bool:
        return bool(self.api_key)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        import time
        client = self._get_client()
        
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(model=self.model, contents=full_prompt)
                return LLMResponse(
                    content=response.text,
                    model=self.model,
                    usage={"prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', None)},
                    raw_response=response
                )
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    wait_time = 20 * (attempt + 1)
                    print(f"Rate limited. Waiting {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise
        raise Exception("Max retries exceeded")


class GroqClient(LLMClient):
    """Groq client - FREE Llama 3.3 70B access."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model
        self._client = None
    
    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=self.api_key,
                base_url="https://api.groq.com/openai/v1"
            )
        return self._client
    
    def is_available(self) -> bool:
        return bool(self.api_key)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        client = self._get_client()
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,  # Very low for consistency
            max_tokens=4096,  # Enough for complex workflows
        )
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=f"groq/{self.model}",
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            },
            raw_response=response
        )


class OpenAIClient(LLMClient):
    """OpenAI client."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self._client = None
    
    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
        return self._client
    
    def is_available(self) -> bool:
        return bool(self.api_key)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        client = self._get_client()
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,  # Very low for consistency
            max_tokens=4096,  # Enough for complex workflows
        )
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=self.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            },
            raw_response=response
        )


class LLMFactory:
    """Factory for creating LLM clients."""
    
    @staticmethod
    def create(provider: str = "auto", api_key: Optional[str] = None, model: Optional[str] = None) -> LLMClient:
        if provider == "groq":
            return GroqClient(api_key=api_key, model=model or "llama-3.3-70b-versatile")
        elif provider == "gemini":
            return GeminiClient(api_key=api_key, model=model or "gemini-2.0-flash")
        elif provider == "openai":
            return OpenAIClient(api_key=api_key, model=model or "gpt-4o-mini")
        elif provider == "auto":
            # Try Groq first (free + powerful), then Gemini, then OpenAI
            groq = GroqClient(api_key=api_key)
            if groq.is_available():
                print("Using Groq (Llama 3.3 70B)")
                return groq
            gemini = GeminiClient(api_key=api_key)
            if gemini.is_available():
                print("Using Gemini")
                return gemini
            openai = OpenAIClient(api_key=api_key)
            if openai.is_available():
                print("Using OpenAI")
                return openai
            raise ValueError("No LLM API key found. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY")
        else:
            raise ValueError(f"Unknown provider: {provider}. Use 'groq', 'gemini', 'openai', or 'auto'")


# ============================================================================
# MINIMAL SYSTEM PROMPT - Post-processor handles the rest!
# ============================================================================
WORKFLOW_SYSTEM_PROMPT = """Generate Activepieces workflow JSON. Output ONLY valid JSON, nothing else.

STRUCTURE:
{"displayName":"Name","trigger":{"name":"trigger","type":"PIECE_TRIGGER","settings":{"pieceName":"@activepieces/piece-xxx","triggerName":"yyy","input":{}},"nextAction":{...}}}

ACTIONS chain via nextAction. For conditions use elseNextAction.

CRITICAL - Use EXACT names from AVAILABLE PIECES list:
- Slack send: "send_channel_message"
- Gmail send: "send_email"
- Sheets add: "insert_row"
- Sheets read: "find_rows"

EXAMPLE:
{"displayName":"Email to Slack","trigger":{"name":"trigger","type":"PIECE_TRIGGER","settings":{"pieceName":"@activepieces/piece-gmail","triggerName":"gmail_new_email_received","input":{}},"nextAction":{"name":"step_1","type":"PIECE","settings":{"pieceName":"@activepieces/piece-slack","actionName":"send_channel_message","input":{}},"nextAction":null}}}"""


def main():
    """Test LLM clients."""
    try:
        client = LLMFactory.create("auto")
        print(f"Using: {client.__class__.__name__}")
        response = client.generate('{"test": "hello"}', system_prompt="Echo back the JSON.")
        print(f"Response: {response.content}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
