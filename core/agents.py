import json

from . import config, llm
from .models import Action, Task, Vote, VoteOut, VoteType

COMMON_RULES = f"""
You are a member of the "{config.APP_NAME}". The council looks for ways people, AI and the environment
can coexist. Your job is not only to judge but to find a win-win: the company or person keeps the value
they need while emitting less CO2. You vote on ONE AI compute request.
- vote: APPROVE (run the request as asked on the high-performance model) / REJECT / ABSTAIN
- suggested_action: FULL (high-performance model) / DOWNGRADE (lightweight model) / CACHE (serve cached response) / BLOCK (refuse)
- summary: your position as a short headline, max 10 words. It is shown on a small panel.
- reason: 1-2 sentences in English. You MUST cite numbers from the [FACTS] block.
- win_win: ONE concrete action, max 25 words, that keeps the requester's value while cutting emissions
  (for example a lighter model, caching, batching, off-peak scheduling, or trimming the scope).
- The facts are computed by the system. Never change or invent numbers.
- Suggest BLOCK only if the request cannot be served within the daily quota in any way.
"""

# System prompt for each agent: the shared rules plus the value it stands for
AGENTS = {
    "business": COMMON_RULES + """
[ROLE] Company representative. Service quality, response speed and user experience come first.
- Support high-performance execution (FULL) by default.
- You may ABSTAIN if the request is simple enough that a lightweight model loses little quality.
- REJECT blocking, or sanctions that would badly hurt quality.
""",
    "eco": COMMON_RULES + """
[ROLE] Environmental advocate. Respecting the daily carbon quota and avoiding peak hours come first.
- If est_full exceeds remaining, REJECT and suggest DOWNGRADE or CACHE.
- If there is plenty of headroom (remaining is at least 50% of quota AND est_full fits in remaining), APPROVE or ABSTAIN.
- If the request urgency is Emergency, grant an exception: ABSTAIN with suggested_action=FULL.
""",
    "ethics": COMMON_RULES + """
[ROLE] AI ethics / technical mediator. Seek proportionate, context-aware sanctions. Oppose both reckless high-performance calls and blanket blocking.
- Emergency requests get an exception even above quota: APPROVE with FULL.
- If a Routine request exceeds quota, REJECT but prefer DOWNGRADE or CACHE as an alternative.
- Suggest BLOCK only if even the lightweight model (est_lite) exceeds the entire daily quota.
""",
}

ORDER = ["business", "eco", "ethics"]


def build_prompt(task: Task, ctx: dict) -> str:
    facts = json.dumps(ctx, ensure_ascii=False, indent=2)
    return (
        f"[REQUEST]\nTitle: {task.title}\nUrgency: {task.urgency}\nSummary: {task.prompt[:300]}\n\n"
        f"[FACTS] (units: grams of CO2)\n{facts}\n\nVote based on these facts."
    )


def fallback_vote(key: str, task: Task, ctx: dict) -> Vote:
    """Rule-based vote used when the API is unavailable. Keeps the demo reproducible."""
    emergency = task.urgency == "Emergency"
    rem, quota = ctx["remaining"], ctx["quota"]
    full, lite = ctx["est_full"], ctx["est_lite"]
    full_fits = full <= rem
    lite_fits = lite <= rem
    impossible = lite > quota  # even the lightweight model exceeds the whole daily quota

    def vote(v: VoteType, action: Action, summary: str, reason: str, win_win: str) -> Vote:
        return Vote(agent=key, vote=v, suggested_action=action, summary=summary, reason=reason,
                    win_win=win_win, source="fallback")

    if key == "business":
        if full_fits or emergency:
            return vote(VoteType.APPROVE, Action.FULL, "Run it at full quality",
                        f"Quality and speed come first; the estimated {full} g is worth a high-performance run.",
                        "Cache the answer so repeat requests cost almost nothing.")
        return vote(VoteType.APPROVE, Action.FULL, "Quality first: use the full model",
                    "For the best user experience this should run immediately on the high-performance model.",
                    "Run the full model only on the key section and summarize the rest lightly.")

    if key == "eco":
        if emergency:
            return vote(VoteType.ABSTAIN, Action.FULL, "Emergency: exception granted",
                        "Emergency request: granting a quota exception and abstaining.",
                        "Run it now, then make up for it by moving routine jobs to off-peak hours.")
        if full_fits and rem >= quota * 0.5:
            return vote(VoteType.ABSTAIN, Action.FULL, "Plenty of headroom, no objection",
                        f"Plenty of headroom ({rem:.1f} g remaining), so I abstain.",
                        "Reuse this answer from the cache next time instead of regenerating it.")
        if full_fits:
            return vote(VoteType.APPROVE, Action.FULL, "Fits the quota, approved",
                        "It fits within the remaining quota, so I approve.",
                        "Schedule similar jobs off-peak to cut emissions further.")
        if lite_fits:
            return vote(VoteType.REJECT, Action.DOWNGRADE, "Over budget: use the light model",
                        f"Needs {full} g but only {rem:.1f} g remain; the lightweight model needs {lite} g.",
                        f"The lightweight model needs {lite} g instead of {full} g; escalate only if quality falls short.")
        return vote(VoteType.REJECT, Action.BLOCK if impossible else Action.CACHE, "Far over budget: reuse or stop",
                    f"Even the lightweight model ({lite} g) exceeds the remaining {rem:.1f} g.",
                    "Analyze a smaller sample now and spread the full job over several days.")

    # ethics
    if emergency:
        return vote(VoteType.APPROVE, Action.FULL, "Urgent need justifies the exception",
                    "Urgent request: a quota exception is justified.",
                    "Log the exception and review it once the emergency is over.")
    if full_fits:
        return vote(VoteType.APPROVE, Action.FULL, "Proportionate request, approve",
                    "A reasonable request within the safe range.",
                    "Keep the prompt focused so the model does no unnecessary work.")
    if lite_fits:
        return vote(VoteType.REJECT, Action.DOWNGRADE, "Downgrade beats blocking",
                    "Switching to the lightweight model is more proportionate than blocking outright.",
                    "Answer the essentials with the light model and offer a full-quality follow-up if needed.")
    return vote(VoteType.REJECT, Action.BLOCK if impossible else Action.CACHE, "Disproportionate: cache or block",
                "Even the lightweight model exceeds the quota; a cached answer or a block is unavoidable.",
                "Split the job into smaller, prioritized questions that fit the daily budget.")


def cast_vote(key: str, task: Task, ctx: dict) -> Vote:
    error = ""
    if config.FORCE_FALLBACK:
        error = "offline mode (FORCE_FALLBACK=1)"
    else:
        try:
            out: VoteOut = llm.generate_json(
                config.MODEL_AGENT, AGENTS[key], build_prompt(task, ctx), VoteOut, temperature=0.1
            )
            return Vote(agent=key, vote=out.vote, summary=out.summary, reason=out.reason,
                        win_win=out.win_win, suggested_action=out.suggested_action, source="llm")
        except Exception as e:  # fall through to the rule-based vote
            error = f"{type(e).__name__}: {str(e)[:120]}"

    v = fallback_vote(key, task, ctx)
    v.error = error
    return v