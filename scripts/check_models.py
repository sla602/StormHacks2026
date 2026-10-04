"""List the Gemini models your key can use: python scripts/check_models.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import llm  # noqa: E402

for m in llm.get_client().models.list():
    actions = getattr(m, "supported_actions", None) or []
    if "generateContent" in actions:
        print(m.name)