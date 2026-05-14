from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from retrieval_pipeline import parse_query_fallback

from .contracts import Plan, SkillStep


PLAN_VERSION = "planner-v1"
DEFAULT_LATENCY_MS = 900
DEFAULT_COST_USD = 0.01
MINIMAL_LATENCY_MS = 200


def plan_to_dict(plan: Plan) -> dict:
    return asdict(plan)


class PlanEngine:
    def __init__(self, run_store):
        self.run_store = run_store

    async def create_plan(
        self,
        question: str,
        member_id: Optional[str] = None,
        image_url: Optional[str] = None,
        max_latency_ms: int = DEFAULT_LATENCY_MS,
    ) -> Plan:
        question_hash = self.run_store.question_hash(question)
        cached = await self.run_store.get_question_cache(question_hash, member_id)
        if cached:
            await self.run_store.increment_question_cache_hit(question_hash, member_id)
            cached_intent = cached.get("last_intent") or {}
            intent = cached_intent.get("intent") or "general_qa"
            return self._build_plan(
                question=question,
                image_url=image_url,
                intent=intent,
                confidence=float(cached_intent.get("confidence") or 0.7),
                cache_hit=True,
                cached_from_run_id=cached.get("last_run_id"),
                max_latency_ms=max_latency_ms,
            )

        payload = parse_query_fallback(question, has_image=bool(image_url))
        return self._build_plan(
            question=question,
            image_url=image_url,
            intent=payload.intent,
            confidence=payload.confidence,
            cache_hit=False,
            cached_from_run_id=None,
            max_latency_ms=max_latency_ms,
        )

    async def record_completed_run(
        self,
        question: str,
        member_id: Optional[str],
        run_id: str,
        plan: Plan,
        evidence_quality: str,
        declined_external: bool = False,
    ) -> None:
        await self.run_store.upsert_question_cache({
            "question_hash": self.run_store.question_hash(question),
            "member_key": member_id or "anonymous",
            "last_run_id": run_id,
            "last_intent": {
                "intent": plan.intent,
                "confidence": plan.confidence,
                "plan_version": plan.plan_version,
            },
            "last_evidence_quality": evidence_quality,
            "declined_external": declined_external,
        })

    def _build_plan(
        self,
        question: str,
        image_url: Optional[str],
        intent: str,
        confidence: float,
        cache_hit: bool,
        cached_from_run_id: Optional[str],
        max_latency_ms: int,
    ) -> Plan:
        fallback_used = max_latency_ms < DEFAULT_LATENCY_MS
        latency_ms = MINIMAL_LATENCY_MS if fallback_used else DEFAULT_LATENCY_MS
        if fallback_used:
            latency_ms = min(max_latency_ms, MINIMAL_LATENCY_MS)

        inputs = {
            "question": question,
            "image_url": image_url,
            "intent": intent,
            "retrieval_mode": "minimal" if fallback_used else "full",
            "allow_external": False,
        }

        return Plan(
            intent=intent,
            confidence=confidence,
            skill_chain=[
                SkillStep(
                    skill_name="content_research",
                    inputs=inputs,
                    depends_on=[],
                    parallel_with=[],
                )
            ],
            estimated_latency_ms=latency_ms,
            estimated_cost_usd=DEFAULT_COST_USD,
            requires_confirmation_at_end=False,
            plan_version=PLAN_VERSION,
            cache_hit=cache_hit,
            cached_from_run_id=cached_from_run_id,
            fallback_used=fallback_used,
            fallback_reason="latency_budget" if fallback_used else None,
        )
