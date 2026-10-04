from concurrent.futures import ThreadPoolExecutor

from . import calculator
from .agents import ORDER, cast_vote
from .models import SEVERITY, Action, Task, Verdict, Vote, VoteType


def build_context(task: Task, ledger, peak: bool) -> dict:
    """Facts computed in Python and handed to the agents (they must not invent numbers)."""
    return {
        "quota": ledger.quota,
        "used": round(ledger.used, 2),
        "remaining": round(ledger.remaining, 2),
        "usage_pct": round(ledger.used / ledger.quota * 100, 1) if ledger.quota else 100.0,
        "peak_hour": peak,
        "urgency": task.urgency,
        "est_full": calculator.estimate_co2(task, Action.FULL, peak),
        "est_lite": calculator.estimate_co2(task, Action.DOWNGRADE, peak),
        "est_cache": calculator.estimate_co2(task, Action.CACHE, peak),
    }


def convene(task: Task, ctx: dict) -> list[Vote]:
    """Call the 3 agents in parallel. Results come back in ORDER."""
    with ThreadPoolExecutor(max_workers=3) as ex:
        return list(ex.map(lambda k: cast_vote(k, task, ctx), ORDER))


def tally(votes: list[Vote]) -> tuple[Action, int, int, int]:
    approve = sum(v.vote == VoteType.APPROVE for v in votes)
    reject = sum(v.vote == VoteType.REJECT for v in votes)
    abstain = sum(v.vote == VoteType.ABSTAIN for v in votes)

    if reject == 0 and approve > 0:
        action = Action.FULL                      # no objections -> run as requested
    elif approve >= reject:
        action = Action.DOWNGRADE                 # conditional approval / tie -> compromise
    else:
        # Rejection wins -> take the mildest sanction suggested by the rejecting agents
        suggestions = [v.suggested_action for v in votes if v.vote == VoteType.REJECT]
        suggestions = [a if a != Action.FULL else Action.DOWNGRADE for a in suggestions]
        action = min(suggestions, key=lambda a: SEVERITY[a])
    return action, approve, reject, abstain


def apply_constitution(action: Action, task: Task, ctx: dict) -> tuple[Action, list[str]]:
    """Hard rules in Python that correct unreasonable LLM votes (the 'judiciary')."""
    notes = []
    emergency = task.urgency == "Emergency"

    if action == Action.FULL and emergency and ctx["est_full"] > ctx["remaining"]:
        notes.append("Constitution: emergency exception applied - quota overdraft permitted for this request")
    if action == Action.FULL and not emergency and ctx["est_full"] > ctx["remaining"]:
        action = Action.DOWNGRADE
        notes.append("Constitution: a non-emergency request may not exceed the remaining quota on the full model -> DOWNGRADE")
    if action == Action.DOWNGRADE and not emergency and ctx["est_lite"] > ctx["remaining"]:
        action = Action.CACHE
        notes.append("Constitution: even the lightweight model exceeds the remaining quota -> CACHE")
    if action == Action.BLOCK:
        allowed = (not emergency) and (ctx["est_lite"] > ctx["quota"] or ctx["remaining"] <= 0)
        if not allowed:
            action = Action.CACHE
            notes.append("Constitution: blocking is only allowed when the quota is exhausted or the request is impossible -> CACHE")
    return action, notes


def decide(votes: list[Vote], task: Task, ctx: dict) -> Verdict:
    tally_action, approve, reject, abstain = tally(votes)
    final, notes = apply_constitution(tally_action, task, ctx)
    return Verdict(action=final, approve=approve, reject=reject, abstain=abstain,
                   tally_action=tally_action, notes=notes)