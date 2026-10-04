"""Thin wrapper around the Gemini API (google-genai SDK, NOT the deprecated google-generativeai)."""
import threading

from . import config

_client = None
_lock = threading.Lock()


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


def generate_json(model: str, system: str, prompt: str, schema, temperature: float = 0.2):
    """Return an instance of the pydantic `schema`, filled in by Gemini."""
    from google.genai import types

    resp = get_client().models.generate_content(
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

    resp = get_client().models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=system, temperature=temperature),
    )
    usage = getattr(resp, "usage_metadata", None)
    tokens = getattr(usage, "total_token_count", 0) if usage else 0
    return resp.text or "", tokens