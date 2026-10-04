from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, Field


class VoteType(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ABSTAIN = "ABSTAIN"


class Action(str, Enum):
    FULL = "FULL"            # run on the high-performance model as requested
    DOWNGRADE = "DOWNGRADE"  # switch to the lightweight model + shorter prompt
    CACHE = "CACHE"          # serve a cached response instead
    BLOCK = "BLOCK"          # circuit breaker: refuse the request


# Higher number = stricter sanction
SEVERITY = {Action.FULL: 0, Action.DOWNGRADE: 1, Action.CACHE: 2, Action.BLOCK: 3}


class VoteOut(BaseModel):
    """Structured-output schema that Gemini fills in."""
    vote: VoteType
    summary: str   # short headline shown on the agent's panel
    reason: str
    win_win: str   # one concrete idea that keeps value while cutting CO2
    suggested_action: Action


class Vote(BaseModel):
    agent: str  # business / eco / ethics
    vote: VoteType
    summary: str = ""
    reason: str
    win_win: str = ""
    suggested_action: Action
    source: str = "llm"  # llm | fallback
    error: str = ""      # why the rule-based fallback was used (if it was)


@dataclass
class Task:
    id: str
    title: str
    prompt: str
    urgency: str = "Routine"  # Routine | Emergency
    payload_tokens: int = 0   # demo only: pretend the job is this many tokens large
    description: str = ""


@dataclass
class Verdict:
    action: Action
    approve: int
    reject: int
    abstain: int
    tally_action: Action  # majority result before the constitution check
    notes: list = field(default_factory=list)  # records of hard-rule interventions

    @property
    def tally_str(self) -> str:
        return f"{self.approve} approve : {self.reject} reject : {self.abstain} abstain"


class PlanOut(BaseModel):
    """Structured-output schema for the council's win-win recommendation."""
    headline: str
    steps: list[str]


class Plan(BaseModel):
    headline: str
    steps: list[str] = Field(default_factory=list)
    source: str = "llm"  # llm | fallback
    error: str = ""      # why the template plan was used (if it was)