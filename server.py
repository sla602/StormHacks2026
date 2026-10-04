"""FastAPI backend for the React UI.
Dev:   uvicorn server:app --reload --port 8000   (and `npm run dev` in frontend/)
Prod:  cd frontend && npm run build, then uvicorn server:app --host 0.0.0.0 --port 8000
"""
import base64
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from core import config, tts
from core.agents import AGENTS, ORDER
from core.council import build_context, convene, decide
from core.executor import execute
from core.ledger import Ledger
from core.models import Task
from core.synth import build_plan

ROOT = Path(__file__).resolve().parent
PRESETS = json.loads((ROOT / "data" / "presets.json").read_text(encoding="utf-8"))
PRESETS_OTTER = json.loads((ROOT / "data" / "presets_otter.json").read_text(encoding="utf-8"))
DIST = ROOT / "frontend" / "dist"
MAX_PENDING = 20

app = FastAPI(title=config.APP_NAME)

# One shared in-memory ledger: fine for a single-presenter demo, shared by everyone if deployed.
ledger = Ledger(quota=config.DEFAULT_QUOTA_G)
pending: dict[str, dict] = {}  # run_id -> deliberation waiting to be executed
lock = threading.Lock()


class CaseIn(BaseModel):
    id: str = Field("custom", max_length=50)
    title: str = Field("", max_length=200)
    prompt: str = Field(..., max_length=4000)
    urgency: Literal["Routine", "Emergency"] = "Routine"
    payload_tokens: int = Field(5000, ge=100, le=1_000_000)
    peak: bool = False
    quota: float = Field(config.DEFAULT_QUOTA_G, ge=10, le=200)


class ExecuteIn(BaseModel):
    run_id: str
    narrate: bool = True
    theme: Literal["terminal", "otter"] = "terminal"  # picks the voices and wording


def ledger_state() -> dict:
    return {
        "quota": ledger.quota,
        "used": round(ledger.used, 2),
        "remaining": round(ledger.remaining, 2),
        "history": ledger.history,
    }


def verdict_json(verdict) -> dict:
    return {
        "action": verdict.action.value,
        "tally_action": verdict.tally_action.value,
        "approve": verdict.approve,
        "reject": verdict.reject,
        "abstain": verdict.abstain,
        "tally": verdict.tally_str,
        "notes": verdict.notes,
    }


def audio_json(audio: dict | None) -> dict | None:
    """MP3 bytes -> base64. The browser joins the segments into one track itself."""
    if audio is None:
        return None
    return {
        "error": audio["error"],
        "notes": audio.get("notes", []),
        "segments": [
            {"speaker": s["speaker"], "text": s["text"], "audio": base64.b64encode(s["audio"]).decode()}
            for s in audio["segments"]
        ],
    }


@app.get("/api/config")
def get_config():
    return {
        "presets": PRESETS,
        "presets_otter": PRESETS_OTTER,
        "order": ORDER,
        "agents": {k: {"name": AGENTS[k]["name"]} for k in ORDER},
        "has_tts": config.HAS_TTS,
        "has_gemini_key": config.HAS_API_KEY,
        "offline": config.FORCE_FALLBACK,
        "models": {"full": config.MODEL_FULL, "lite": config.MODEL_LITE},
        "ledger": ledger_state(),
    }


@app.post("/api/deliberate")
def deliberate(body: CaseIn):
    """Step 1: the council votes. Nothing is charged yet."""
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(400, "Describe the case before convening the council.")

    task = Task(id=body.id, title=body.title.strip()[:100] or prompt[:40], prompt=prompt,
                urgency=body.urgency, payload_tokens=body.payload_tokens)
    with lock:
        ledger.quota = body.quota
        ctx = build_context(task, ledger, body.peak)

    votes = convene(task, ctx)  # slow part: 3 parallel Gemini calls
    verdict = decide(votes, task, ctx)
    plan = build_plan(task, ctx, votes, verdict)  # secretary: one win-win recommendation

    run_id = uuid.uuid4().hex
    with lock:
        pending[run_id] = {"task": task, "ctx": ctx, "votes": votes, "verdict": verdict,
                           "plan": plan, "peak": body.peak}
        while len(pending) > MAX_PENDING:  # drop the oldest abandoned runs
            pending.pop(next(iter(pending)))

    return {
        "run_id": run_id,
        "question": prompt,
        "ctx": ctx,
        "votes": [v.model_dump(mode="json") for v in votes],
        "verdict": verdict_json(verdict),
        "plan": plan.model_dump(),
    }


@app.post("/api/execute")
def run_execute(body: ExecuteIn):
    """Step 2: carry out the verdict, synthesize the narration in parallel, charge the ledger."""
    with lock:
        run = pending.pop(body.run_id, None)
    if run is None:
        raise HTTPException(404, "This session has expired or already ran. Convene the council again.")

    task, ctx, votes, verdict, plan = run["task"], run["ctx"], run["votes"], run["verdict"], run["plan"]
    with ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(tts.generate_session_audio, task, votes, verdict, plan, body.theme) \
            if (body.narrate and config.HAS_TTS) else None
        result = execute(task, verdict, run["peak"])
        audio = fut.result() if fut else None

    with lock:
        ledger.record(task, ctx, votes, verdict, result, plan)
        state = ledger_state()

    return {
        "result": {
            "text": result.text,
            "model": result.model,
            "action": result.effective_action.value,
            "charged_co2": result.charged_co2,
            "tokens": result.tokens,
            "note": result.note,
        },
        "audio": audio_json(audio),
        "ledger": state,
    }


@app.post("/api/reset")
def reset():
    with lock:
        ledger.reset()
        pending.clear()
        return ledger_state()


@app.get("/api/report")
def report():
    with lock:
        body = ledger.report_json()
    return Response(body, media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="eco_governai_audit.json"'})


# Serve the built React app (after `npm run build`). Must come after the /api routes.
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")