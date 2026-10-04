"""List the ElevenLabs voices your key can use: python scripts/list_voices.py"""
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import config  # noqa: E402

key = config.ELEVENLABS_API_KEY
if not key or key == "your_key_here":
    sys.exit("ELEVENLABS_API_KEY is empty or still the placeholder. Check that .env is in the project root.")
if key != key.strip() or key[0] in "\"'":
    print("Warning: the key has spaces or quotes around it. Remove them in .env.")
print(f"Key loaded: {key[:5]}...{key[-4:]} ({len(key)} chars)")

resp = requests.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": key.strip()}, timeout=30)
if resp.status_code != 200:
    # The body says why: invalid_api_key, missing_permissions, quota, ...
    sys.exit(f"HTTP {resp.status_code}: {resp.text[:500]}")

for v in resp.json().get("voices", []):
    print(f"{v['voice_id']}  {v.get('name', '?'):<20} {v.get('category', '')}")