"""Tokens -> grams of CO2. This is an ESTIMATE based on made-up coefficients, not a measurement."""
from .models import Action, Task

# Estimated g CO2 per 1,000 tokens. Only the relative ratios matter for the demo.
FACTOR_PER_1K = {
    Action.FULL: 1.0,
    Action.DOWNGRADE: 0.25,
    Action.CACHE: 0.01,
    Action.BLOCK: 0.0,
}
PEAK_MULTIPLIER = 1.5  # extra weight during peak electricity hours
OUTPUT_RATIO = 0.5     # assume output tokens = 50% of input tokens


def estimate_input_tokens(task: Task) -> int:
    # Rough heuristic: chars / 3, or the demo payload size if that is larger
    return max(len(task.prompt) // 3, task.payload_tokens)


def estimate_tokens(task: Task) -> int:
    return int(estimate_input_tokens(task) * (1 + OUTPUT_RATIO))


def estimate_co2(task: Task, action: Action, peak: bool = False) -> float:
    grams = estimate_tokens(task) / 1000 * FACTOR_PER_1K[action]
    if peak and action in (Action.FULL, Action.DOWNGRADE):
        grams *= PEAK_MULTIPLIER
    return round(grams, 2)