import os

from dotenv import load_dotenv

load_dotenv()

APP_NAME = os.getenv("APP_NAME", "TriBunal Council").strip()  # how the agents refer to their council

# --- Gemini ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_FULL = os.getenv("GEMINI_MODEL_FULL", "gemini-3.5-flash")
MODEL_LITE = os.getenv("GEMINI_MODEL_LITE", "gemini-3-flash-preview")
MODEL_AGENT = os.getenv("GEMINI_MODEL_AGENT") or MODEL_LITE
DEFAULT_QUOTA_G = float(os.getenv("DEFAULT_QUOTA_G", "50"))
API_TIMEOUT_MS = int(os.getenv("API_TIMEOUT_MS", "20000"))
FORCE_FALLBACK = os.getenv("FORCE_FALLBACK", "0") == "1"
HAS_API_KEY = bool(GEMINI_API_KEY)

# --- ElevenLabs ---
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5")
HAS_TTS = bool(ELEVENLABS_API_KEY)


def _voice(env_name: str, default: str) -> str:
    """Voice ID from .env; an empty, quoted or space-padded value falls back to the default."""
    return (os.getenv(env_name) or "").strip().strip("\"'") or default


# One voice per speaker, per theme. Defaults are ElevenLabs premade voices (usable on the free plan).
# If a voice fails, tts.py tries the narrator and then the other voices of that theme for that line.
VOICE_SETS = {
    "terminal": {  # calm, professional
        "narrator": _voice("ELEVENLABS_VOICE_NARRATOR", "JBFqnCBsd6RMkjVDRZzb"),  # George: warm narrator
        "business": _voice("ELEVENLABS_VOICE_BUSINESS", "pNInz6obpgDQGcFmaJgB"),  # Adam: firm, confident
        "eco": _voice("ELEVENLABS_VOICE_ECO", "EXAVITQu4vr4xnSDxMaL"),            # Sarah: soft, caring
        "ethics": _voice("ELEVENLABS_VOICE_ETHICS", "onwK4e9ZLuTAKqWW03F9"),      # Daniel: measured, judicial
    },
    "otter": {  # bright, light, playful
        "narrator": _voice("ELEVENLABS_OTTER_NARRATOR", "cgSgspJ2msm6clMCkdW9"),  # Jessica: playful, bright
        "business": _voice("ELEVENLABS_OTTER_BUSINESS", "bIHbv24MWmeRgasZH58o"),  # Will: friendly, upbeat
        "eco": _voice("ELEVENLABS_OTTER_ECO", "FGY2WhTYpPnrIDTdsKH5"),            # Laura: sunny, quirky
        "ethics": _voice("ELEVENLABS_OTTER_ETHICS", "IKne3meq5aSn9XLyUdCD"),      # Charlie: easygoing
    },
}