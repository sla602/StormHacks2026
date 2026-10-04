"""Verify the whole pipeline without the UI:  python cli_demo.py
Offline (no API):  FORCE_FALLBACK=1 python cli_demo.py"""
import json
from pathlib import Path

from core import config
from core.council import build_context, convene, decide
from core.executor import execute
from core.synth import build_plan
from core.ledger import Ledger
from core.models import Task

presets = json.loads((Path(__file__).parent / "data" / "presets.json").read_text(encoding="utf-8"))
ledger = Ledger(quota=config.DEFAULT_QUOTA_G)

for p in presets:
    task = Task(**p)
    ctx = build_context(task, ledger, peak=False)
    votes = convene(task, ctx)
    verdict = decide(votes, task, ctx)
    plan = build_plan(task, ctx, votes, verdict)
    result = execute(task, verdict, peak=False)
    ledger.record(task, ctx, votes, verdict, result, plan)

    print(f"\n=== {task.title} [{task.urgency}] est_full={ctx['est_full']}g remaining={ctx['remaining']}g")
    for v in votes:
        extra = f" [{v.error}]" if v.error else ""
        print(f"  {v.agent:9s} {v.vote.value:8s} -> {v.suggested_action.value:9s} ({v.source}){extra} {v.reason}")
    print(f"  Result: {verdict.tally_str} | majority={verdict.tally_action.value} final={result.effective_action.value} "
          f"| charged {result.charged_co2}g | total {ledger.used:.2f}/{ledger.quota}g")
    for n in verdict.notes:
        print("  ", n)
    print(f"  Win-win: {plan.headline} ({plan.source})")
    for step in plan.steps:
        print("    -", step)