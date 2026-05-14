PROMPT_VERSION = "answer-from-sources-v1"

INSTRUCTIONS = """Answer only from selected internal evidence. If evidence is weak or empty, say so clearly."""


def build_prompt(question: str, evidence: list[dict], evidence_quality: str) -> str:
    return "\n".join([
        INSTRUCTIONS,
        f"Evidence quality: {evidence_quality}",
        f"Question: {question}",
        f"Evidence count: {len(evidence)}",
    ])
