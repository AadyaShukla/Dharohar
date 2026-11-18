"""Unified LLM integration layer supporting Gemini, Anthropic, and offline Scripted providers."""

import concurrent.futures
import os
import time
from typing import Any, Dict, List, Optional


class LLMRetryExhaustedError(RuntimeError):
    """Raised when LLM call fails after all retry attempts."""
    pass


_scripted_responses: List[Dict[str, Any]] = []


def set_scripted_responses(responses: List[Dict[str, Any]]) -> None:
    """Set the list of deterministic responses to be replayed by the scripted provider."""
    global _scripted_responses
    _scripted_responses = [
        {
            "text": resp.get("text"),
            "tool_calls": resp.get("tool_calls", []),
        }
        for resp in responses
    ]


def _call_scripted() -> Dict[str, Any]:
    """Offline deterministic provider that pops pre-scripted responses."""
    global _scripted_responses
    if not _scripted_responses:
        raise RuntimeError("Scripted LLM error: no scripted responses remaining.")

    response = _scripted_responses.pop(0)
    normalized_tool_calls: List[Dict[str, Any]] = []
    for tc in response.get("tool_calls", []):
        normalized_tool_calls.append(
            {
                "name": tc["name"],
                "arguments": dict(tc.get("arguments", {})),
            }
        )

    return {
        "text": response.get("text"),
        "tool_calls": normalized_tool_calls,
    }


def _call_gemini(
    system_prompt: str,
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Call Google Gemini using the google-genai package."""
    api_key = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("LLM error: Missing API key for Gemini provider. Set LLM_API_KEY.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise RuntimeError(f"LLM error: google-genai package is not installed ({e}).")

    try:
        client = genai.Client(api_key=api_key)
        gemini_tools = None
        if tools:
            function_declarations = []
            for t in tools:
                function_declarations.append(
                    types.FunctionDeclaration(
                        name=t["name"],
                        description=t.get("description", ""),
                        parameters=t.get("parameters", {}),
                    )
                )
            gemini_tools = [types.Tool(function_declarations=function_declarations)]

        contents = []
        for msg in messages:
            contents.append(
                types.Content(
                    role="user" if msg.get("role") in ["user", "system"] else "model",
                    parts=[types.Part.from_text(text=str(msg.get("content", "")))],
                )
            )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt if system_prompt else None,
            tools=gemini_tools,
            temperature=0.2,
        )

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=contents,
            config=config,
        )

        tool_calls: List[Dict[str, Any]] = []
        text_parts: List[str] = []

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.text:
                    text_parts.append(part.text)
                if part.function_call:
                    tool_calls.append(
                        {
                            "name": part.function_call.name,
                            "arguments": dict(part.function_call.args)
                            if part.function_call.args
                            else {},
                        }
                    )

        return {
            "text": "".join(text_parts) if text_parts else None,
            "tool_calls": tool_calls,
        }
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}") from e


def _call_anthropic(
    system_prompt: str,
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Call Anthropic Claude using the anthropic package."""
    api_key = os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("LLM error: Missing API key for Anthropic provider. Set LLM_API_KEY.")

    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError(f"LLM error: anthropic package is not installed ({e}).")

    try:
        client = anthropic.Anthropic(api_key=api_key)

        anthropic_tools = None
        if tools:
            anthropic_tools = [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "input_schema": t.get("parameters", {}),
                }
                for t in tools
            ]

        formatted_messages = [
            {
                "role": "user" if m.get("role") in ["user", "system"] else "assistant",
                "content": str(m.get("content", "")),
            }
            for m in messages
        ]

        kwargs: Dict[str, Any] = {
            "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
            "max_tokens": 1024,
            "messages": formatted_messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        response = client.messages.create(**kwargs)

        text_parts: List[str] = []
        tool_calls: List[Dict[str, Any]] = []

        for block in response.content:
            if getattr(block, "type", "") == "text":
                text_parts.append(block.text)
            elif getattr(block, "type", "") == "tool_use":
                tool_calls.append(
                    {
                        "name": block.name,
                        "arguments": dict(block.input) if block.input else {},
                    }
                )

        return {
            "text": "".join(text_parts) if text_parts else None,
            "tool_calls": tool_calls,
        }
    except Exception as e:
        raise RuntimeError(f"Anthropic API call failed: {e}") from e


def _call_with_timeout(
    fn, timeout_seconds: float = 15.0, *args, **kwargs
) -> Dict[str, Any]:
    """Execute function with strict timeout using thread pool."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn, *args, **kwargs)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(f"LLM request timed out after {timeout_seconds} seconds.")


def llm_call(
    system_prompt: str,
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
    max_retries: int = 3,
    retry_delay_seconds: float = 0.5,
) -> Dict[str, Any]:
    """Execute a normalized LLM call against the configured provider with timeout and retry policy.

    Returns a normalized dictionary:
        {
            "text": str or None,
            "tool_calls": [{"name": str, "arguments": dict}]
        }
    """
    import sys
    from backend.config import get_settings
    settings = get_settings()

    provider = (os.getenv("LLM_PROVIDER") or settings.LLM_PROVIDER or "gemini").strip().lower()

    if provider == "scripted":
        in_test = "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST") is not None
        if not settings.DEMO_MODE and not in_test:
            raise ValueError("Scripted LLM provider cannot be selected when DEMO_MODE=false.")
        return _call_scripted()

    last_error: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            if provider == "gemini":
                return _call_with_timeout(_call_gemini, 15.0, system_prompt, messages, tools)
            elif provider == "anthropic":
                return _call_with_timeout(_call_anthropic, 15.0, system_prompt, messages, tools)
            else:
                raise ValueError(
                    f"Unsupported LLM_PROVIDER '{provider}'. Supported values: 'gemini', 'anthropic', 'scripted'."
                )
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(retry_delay_seconds * attempt)

    raise LLMRetryExhaustedError(
        f"LLM call to '{provider}' failed after {max_retries} attempts. Last error: {last_error}"
    )

