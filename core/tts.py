"""Spoken council sessions via the ElevenLabs text-to-speech REST API.
Every speaker has its own voice, and the wording and voice style follow the UI theme."""
from concurrent.futures import ThreadPoolExecutor

import requests

from . import config
from .models import Action, Plan, Task, Verdict, Vote

API_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
OUTPUT_FORMAT = "mp3_44100_128"  # every clip uses the same format so they can be joined
MAX_CHARS = 600                  # keep each clip short: saves credits and latency
MAX_WORKERS = 2                  # stay under the concurrency limit of lower-tier plans

# How the voices sound in each theme (lower stability = livelier, speed 0.7-1.2)
VOICE_STYLE = {
    "terminal": {"stability": 0.6, "similarity_boost": 0.75, "style": 0.1, "speed": 1.0},
    "otter": {"stability": 0.3, "similarity_boost": 0.7, "style": 0.6, "speed": 1.12},
}

WORDS = {
    "terminal": {
        "names": {"business": "Business Agent", "eco": "Eco Agent", "ethics": "Tech and Ethics Agent"},
        "urgency": {"Routine": "routine", "Emergency": "emergency"},
        "vote": {"APPROVE": "I vote to approve.", "REJECT": "I vote to reject.", "ABSTAIN": "I abstain."},
        "action": {
            Action.FULL: "run on the high performance model",
            Action.DOWNGRADE: "switch to the lightweight model",
            Action.CACHE: "serve a cached response",
            Action.BLOCK: "block the request. The circuit breaker is tripped",
        },
        "intro": "Case: {title}. Urgency: {urgency}. The council will now vote.",
        "agent": "{name}. {vote} {reason} {idea}",
        "idea": "My win-win proposal: {idea}",
        "tally": "The vote is {a} approve, {r} reject, {x} abstain.",
        "adjusted": "A constitutional rule adjusted the majority result.",
        "final": "Final decision: {action}.",
        "plan": "Win-win plan: {plan}",
    },
    "otter": {
        "names": {"business": "Shop Keeper", "eco": "Earth Buddy", "ethics": "Fair Play"},
        "urgency": {"Routine": "normal", "Emergency": "super urgent"},
        "vote": {"APPROVE": "I say yes!", "REJECT": "I say nope!", "ABSTAIN": "I'll pass on this one."},
        "action": {
            Action.FULL: "go big and use the super smart AI",
            Action.DOWNGRADE: "go light and use the little AI",
            Action.CACHE: "reuse an answer we already have",
            Action.BLOCK: "stop, this one is too big for today",
        },
        "intro": "Hi everyone! Today's question is: {title}. It's {urgency}. Let's hear from the otters!",
        "agent": "{name} here! {vote} {reason} {idea}",
        "idea": "My idea: {idea}",
        "tally": "That's {a} yes, {r} nope, and {x} pass.",
        "adjusted": "Our rule book changed the result a little.",
        "final": "The otters say: {action}!",
        "plan": "Here's the plan where everybody wins: {plan}",
    },
}


def synthesize(text: str, voice_id: str, theme: str = "terminal") -> bytes:
    """Return MP3 bytes for `text` spoken in `voice_id`. Raises RuntimeError on API errors."""
    resp = requests.post(
        API_URL.format(voice_id=voice_id),
        params={"output_format": OUTPUT_FORMAT},
        headers={
            "xi-api-key": config.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text[:MAX_CHARS],
            "model_id": config.ELEVENLABS_MODEL,
            "voice_settings": VOICE_STYLE.get(theme, VOICE_STYLE["terminal"]),
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"ElevenLabs HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.content


def build_script(task: Task, votes: list[Vote], verdict: Verdict, plan: Plan | None = None,
                 theme: str = "terminal") -> list[tuple[str, str]]:
    """Turn a council session into [(speaker, text), ...]. Speakers: narrator / business / eco / ethics."""
    w = WORDS.get(theme, WORDS["terminal"])
    title = task.title.strip()[:100] or "an untitled task"
    script = [("narrator", w["intro"].format(title=title, urgency=w["urgency"].get(task.urgency, task.urgency)))]

    for v in votes:
        idea = w["idea"].format(idea=v.win_win) if v.win_win else ""
        script.append((v.agent, w["agent"].format(
            name=w["names"][v.agent], vote=w["vote"][v.vote.value], reason=v.reason, idea=idea).strip()))

    closing = [w["tally"].format(a=verdict.approve, r=verdict.reject, x=verdict.abstain)]
    if verdict.action != verdict.tally_action:
        closing.append(w["adjusted"])
    closing.append(w["final"].format(action=w["action"][verdict.action]))
    if plan and plan.headline:
        closing.append(w["plan"].format(plan=plan.headline))
    script.append(("narrator", " ".join(closing)))
    return script


def _speak(speaker: str, text: str, voices: dict, theme: str) -> tuple[bytes | None, str]:
    """One clip. If the speaker's voice fails (not found, not on your plan), try the narrator,
    then the theme's other voices, so a single bad voice ID never silences a line."""
    candidates = list(dict.fromkeys([voices[speaker], voices["narrator"], *voices.values()]))
    first_error = ""
    for voice_id in candidates:
        try:
            audio = synthesize(text, voice_id, theme)
        except Exception as e:
            first_error = first_error or str(e)[:90]
            continue
        note = "" if voice_id == voices[speaker] else f"{speaker}: used a backup voice ({first_error})"
        return audio, note
    return None, f"{speaker}: {first_error}"


def generate_session_audio(task: Task, votes: list[Vote], verdict: Verdict, plan: Plan | None = None,
                           theme: str = "terminal") -> dict:
    """Return {"error", "notes", "segments": [{speaker, text, audio}], "combined"}. Never raises."""
    empty = {"error": "", "notes": [], "segments": [], "combined": b""}
    if not config.HAS_TTS:
        return {**empty, "error": "ELEVENLABS_API_KEY is not set"}

    voices = config.VOICE_SETS.get(theme, config.VOICE_SETS["terminal"])
    script = build_script(task, votes, verdict, plan, theme)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        results = list(ex.map(lambda seg: _speak(seg[0], seg[1], voices, theme), script))

    notes = [note for _, note in results if note]
    segments = [{"speaker": s, "text": t, "audio": a} for (s, t), (a, _) in zip(script, results) if a]
    if not segments:
        return {**empty, "error": notes[0] if notes else "No audio was generated"}
    return {"error": "", "notes": notes, "segments": segments, "combined": b"".join(s["audio"] for s in segments)}