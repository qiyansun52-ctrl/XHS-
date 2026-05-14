PROMPT_VERSION = "planner-v1"

INSTRUCTIONS = """Classify the user's XHS operations request and choose a skill chain."""


def build_prompt(question: str) -> str:
    return f"{INSTRUCTIONS}\n\nUser question:\n{question}"
