"""Thin wrapper around the Gemini API (google-genai SDK, NOT the deprecated google-generativeai)."""
import threading
import time

from . import config

_client = None
_lock = threading.Lock()
RETRY_WAITS = (2, 6)  # seconds to wait before each retry of a busy or rate-limited call


def get_client():
    """Lazily create one shared client (thread-safe: agents vote in parallel threads)."""
    global _client
    with _lock:
        if _client is None:
            if not config.GEMINI_API_KEY:
                raise RuntimeError("GEMINI_API_KEY is not set")
            from google import genai
            from google.genai import types

            _client = genai.Client(
                api_key=config.GEMINI_API_KEY,
                http_options=types.HttpOptions(timeout=config.API_TIMEOUT_MS),
            )
        return _client


def _retryable(e: Exception) -> bool:
    """Short-lived problems are worth a retry; empty credits or a daily limit are not."""
    msg = str(e)
    if "402" in msg or "PerDay" in msg:
        return False
    return any(code in msg for code in ("429", "500", "503", "504", "UNAVAILABLE", "DEADLINE_EXCEEDED"))


def _generate(**kwargs):
    """generate_content with automatic function calling off (we use no tools) and a short retry."""
    from google.genai import types

    kwargs["config"].automatic_function_calling = types.AutomaticFunctionCallingConfig(disable=True)
    for wait in (*RETRY_WAITS, None):
        try:
            return get_client().models.generate_content(**kwargs)
        except Exception as e:
            if wait is None or not _retryable(e):
                raise
            time.sleep(wait)


def generate_json(model: str, system: str, prompt: str, schema, temperature: float = 0.2):
    """Return an instance of the pydantic `schema`, filled in by Gemini."""
    from google.genai import types

    resp = _generate(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
        ),
    )
    return schema.model_validate_json(resp.text)


def generate_text(model: str, prompt: str, system: str | None = None, temperature: float = 0.5):
    """Return (text, total_tokens)."""
    from google.genai import types

    resp = _generate(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=system, temperature=temperature),
    )
    usage = getattr(resp, "usage_metadata", None)
    tokens = getattr(usage, "total_token_count", 0) if usage else 0
    return resp.text or "", tokens


def short_error(e: Exception) -> str:
    """One readable line explaining an API failure (shown in the UI and the audit report)."""
    msg = str(e)
    if "402" in msg:
        return "Gemini credits are used up (402). Add credits, or set FORCE_FALLBACK=1 for the demo."
    if "PerDay" in msg:
        return "Gemini daily quota is used up (429). Try another key/model, or set FORCE_FALLBACK=1."
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        return "Gemini rate limit reached (429). Wait a minute and try again."
    if "504" in msg or "DEADLINE_EXCEEDED" in msg:
        return "Gemini took too long to answer (504). Try again or raise API_TIMEOUT_MS."
    if "API_KEY_INVALID" in msg or "401" in msg or "403" in msg:
        return "Gemini rejected the API key. Check GEMINI_API_KEY in .env."
    return f"{type(e).__name__}: {msg[:100]}"