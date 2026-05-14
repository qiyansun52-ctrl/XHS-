from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict


class ContentResearchSkill:
    name = "content_research"
    description = "根据用户目标检索团队知识库并生成带证据的研究答案。"
    declared_tools = ["internal_search", "answer_from_sources"]
    typical_latency_ms = 900

    def __init__(self, research_runner: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]):
        self.research_runner = research_runner

    async def run(self, input_payload: Dict[str, Any], ctx: Any = None) -> Dict[str, Any]:
        answer = await self.research_runner({
            "question": input_payload.get("question") or "",
            "image_url": input_payload.get("image_url"),
            "previous_answer_summary": input_payload.get("previous_answer_summary"),
            "previous_citation_ids": input_payload.get("previous_citation_ids") or [],
        })
        evidence_quality = answer.get("evidence_quality") or ("weak" if answer.get("sparse") else "strong")
        can_external = bool(answer.get("can_external_discover"))
        reason = answer.get("discovery_trigger_reason")
        if can_external:
            reason = reason or ("zero_recall" if evidence_quality == "empty" else "sparse_recall")
            external_decision = {
                "decision": "propose",
                "reason": reason,
            }
        else:
            external_decision = {
                "decision": "skip",
                "reason": None,
            }

        return {
            "skill_name": self.name,
            "intent": input_payload.get("intent"),
            "evidence_quality": evidence_quality,
            "answer": answer,
            "external_discovery_decision": external_decision,
        }
