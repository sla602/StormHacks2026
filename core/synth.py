"""Secretary step: turn the three votes and the final decision into ONE win-win plan for the requester."""
import json

from . import config, llm
from .models import Action, Plan, PlanOut, Task, Verdict, Vote

SYSTEM = f"""You are the secretary of the {config.APP_NAME}, which looks for ways people, AI and the
environment can coexist. Write the council's recommendation for the person or company that made the request.
- headline: max 15 words. Say what will happen and why it is a win-win.
- steps: 2-3 concrete actions, max 20 words each, that keep the requester's value while cutting CO2.
- The FINAL DECISION is binding. Never recommend anything that contradicts it.
- Use numbers only from [FACTS]; never invent numbers. English only."""


def fallback_plan(task: Task, ctx: dict, verdict: Verdict, error: str = "") -> Plan:
    """Template plan used when Gemini is unavailable."""
    full, lite = ctx["est_full"], ctx["est_lite"]
    a = verdict.action
    if a == Action.FULL and task.urgency == "Emergency":
        headline = "Emergency: run now at full quality, then rebalance today's budget."
        steps = ["Move routine jobs to off-peak hours to make up for the overdraft.",
                 "Cache the answer so follow-up questions cost almost nothing."]
    elif a == Action.FULL:
        headline = f"Run at full quality: {full} g fits today's budget."
        steps = ["Cache the answer so repeat requests cost almost nothing.",
                 "Schedule similar large jobs outside peak hours."]
    elif a == Action.DOWNGRADE:
        headline = f"Use the lightweight model: {lite} g instead of {full} g, core answer kept."
        steps = ["Ask for the essentials first and escalate to the full model only if needed.",
                 "Batch related requests into one call."]
    elif a == Action.CACHE:
        headline = "Reuse a stored answer now and refresh it when the quota resets."
        steps = ["Check whether the cached answer covers what you need.",
                 "Run a fresh, narrower request tomorrow during off-peak hours."]
    else:
        headline = "Too big for today's budget: split it into smaller jobs."
        steps = ["Analyze a representative sample instead of the full dataset.",
                 "Spread the full job over several days, off-peak."]
    return Plan(headline=headline, steps=steps, source="fallback", error=error)


def build_prompt(task: Task, ctx: dict, votes: list[Vote], verdict: Verdict) -> str:
    lines = [f"- {v.agent}: {v.vote.value} (suggests {v.suggested_action.value}). {v.reason} "
             f"Win-win idea: {v.win_win}" for v in votes]
    notes = "\n".join(verdict.notes) or "none"
    return (
        f"[REQUEST]\nTitle: {task.title}\nUrgency: {task.urgency}\nSummary: {task.prompt[:300]}\n\n"
        f"[FACTS] (grams of CO2)\n{json.dumps(ctx, indent=2)}\n\n"
        f"[VOTES]\n" + "\n".join(lines) + "\n\n"
        f"[FINAL DECISION] {verdict.action.value} ({verdict.tally_str})\nConstitution notes: {notes}"
    )


def build_plan(task: Task, ctx: dict, votes: list[Vote], verdict: Verdict) -> Plan:
    if config.FORCE_FALLBACK:
        return fallback_plan(task, ctx, verdict, "offline mode (FORCE_FALLBACK=1)")
    try:
        out: PlanOut = llm.generate_json(config.MODEL_AGENT, SYSTEM, build_prompt(task, ctx, votes, verdict),
                                         PlanOut, temperature=0.3)
        steps = [s.strip() for s in out.steps if s.strip()][:3]
        if not out.headline.strip() or not steps:
            raise ValueError("empty plan")
        return Plan(headline=out.headline.strip(), steps=steps, source="llm")
    except Exception as e:
        return fallback_plan(task, ctx, verdict, llm.short_error(e))