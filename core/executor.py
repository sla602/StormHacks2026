import json
from dataclasses import dataclass
from pathlib import Path

from . import calculator, config, llm
from .models import Action, Task, Verdict

CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "cache.json"

BLOCK_MESSAGE = (
    "Request blocked: the carbon quota was exceeded and the council voted it down. "
    "Please narrow the request or try again after the quota resets."
)
DEFAULT_CACHE_TEXT = "(cached) A stored response for a similar request was reused."


@dataclass
class Result:
    text: str
    model: str
    effective_action: Action
    charged_co2: float
    tokens: int = 0
    note: str = ""


def _load_cache() -> dict:
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _cache_result(task: Task, peak: bool, note: str = "") -> Result:
    text = _load_cache().get(task.id, DEFAULT_CACHE_TEXT)
    return Result(text, "cache", Action.CACHE, calculator.estimate_co2(task, Action.CACHE, peak), note=note)


def execute(task: Task, verdict: Verdict, peak: bool) -> Result:
    action = verdict.action

    if action == Action.BLOCK:
        return Result(BLOCK_MESSAGE, "none", Action.BLOCK, 0.0)
    if action == Action.CACHE:
        return _cache_result(task, peak)

    model = config.MODEL_FULL if action == Action.FULL else config.MODEL_LITE
    prompt = task.prompt if action == Action.FULL else "Answer concisely, essentials only.\n" + task.prompt

    if config.FORCE_FALLBACK:
        text, tokens = f"[offline mode] {model} call skipped - dummy response for the {action.value} path.", 0
    else:
        try:
            text, tokens = llm.generate_text(model, prompt)
        except Exception as e:  # the service never goes down: degrade gracefully to the cache
            return _cache_result(task, peak, note=f"Served from cache. {llm.short_error(e)}")

    return Result(text, model, action, calculator.estimate_co2(task, action, peak), tokens=tokens)