import json
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Ledger:
    quota: float = 50.0
    used: float = 0.0
    history: list = field(default_factory=list)

    @property
    def remaining(self) -> float:
        return self.quota - self.used

    def record(self, task, ctx, votes, verdict, result, plan=None) -> dict:
        self.used += result.charged_co2
        entry = {
            "time": datetime.now().strftime("%H:%M:%S"),
            "task": task.title,
            "urgency": task.urgency,
            "peak_hour": ctx["peak_hour"],
            "votes": [
                {"agent": v.agent, "vote": v.vote.value, "suggested_action": v.suggested_action.value,
                 "summary": v.summary, "reason": v.reason, "win_win": v.win_win,
                 "source": v.source, "error": v.error}
                for v in votes
            ],
            "tally": verdict.tally_str,
            "tally_action": verdict.tally_action.value,
            "final_action": result.effective_action.value,
            "constitution_notes": verdict.notes + ([result.note] if result.note else []),
            "plan": plan.model_dump() if plan else None,
            "model": result.model,
            "co2_charged_g": result.charged_co2,
            "co2_used_total_g": round(self.used, 2),
            "quota_g": self.quota,
        }
        self.history.append(entry)
        return entry

    def reset(self):
        self.used = 0.0
        self.history.clear()

    def report_json(self) -> str:
        return json.dumps(
            {"quota_g": self.quota, "used_g": round(self.used, 2), "entries": self.history},
            ensure_ascii=False, indent=2,
        )