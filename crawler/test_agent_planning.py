import asyncio
import unittest

from agent.events import AgentEventBus
from agent.orchestrator import AgentOrchestrator
from agent.planning import PlanEngine
from agent.run_store import AgentRunStore
from agent.skills.content_research import ContentResearchSkill
from agent.tool_invoker import ToolInvoker


class AgentPlanningTests(unittest.IsolatedAsyncioTestCase):
    async def test_plan_engine_routes_material_question_to_content_research(self):
        store = AgentRunStore()
        planner = PlanEngine(store)

        plan = await planner.create_plan("帮我找一下英国春天标题素材", member_id="member-1")

        self.assertEqual(plan.intent, "find_material")
        self.assertFalse(plan.cache_hit)
        self.assertFalse(plan.fallback_used)
        self.assertEqual(plan.skill_chain[0].skill_name, "content_research")
        self.assertEqual(plan.skill_chain[0].inputs["question"], "帮我找一下英国春天标题素材")
        self.assertEqual(plan.skill_chain[0].inputs["intent"], "find_material")

    async def test_plan_engine_uses_question_cache_for_repeat_question(self):
        store = AgentRunStore()
        planner = PlanEngine(store)

        first = await planner.create_plan("英国春天标题素材", member_id="member-1")
        await planner.record_completed_run(
            question="英国春天标题素材",
            member_id="member-1",
            run_id="run-1",
            plan=first,
            evidence_quality="strong",
        )

        second = await planner.create_plan("英国春天标题素材", member_id="member-1")

        self.assertTrue(second.cache_hit)
        self.assertEqual(second.cached_from_run_id, "run-1")
        self.assertEqual(second.intent, first.intent)
        self.assertEqual(second.skill_chain[0].skill_name, "content_research")

    async def test_plan_engine_marks_low_budget_fallback(self):
        store = AgentRunStore()
        planner = PlanEngine(store)

        plan = await planner.create_plan("帮我找一下英国春天标题素材", member_id=None, max_latency_ms=200)

        self.assertTrue(plan.fallback_used)
        self.assertEqual(plan.fallback_reason, "latency_budget")
        self.assertEqual(plan.estimated_latency_ms, 200)
        self.assertEqual(plan.skill_chain[0].inputs["retrieval_mode"], "minimal")

    async def test_orchestrator_writes_planner_output_to_plan_step(self):
        async def fake_research(request):
            await asyncio.sleep(0)
            return {
                "question": request["question"],
                "task_type": "material",
                "conclusion": "英国春天标题可以从校园和樱花切入。",
                "recommendations": [],
                "cited_sources": [],
                "related_sources": [],
                "general_advice": [],
                "material_references": [],
                "team_history_references": [],
                "sparse": False,
                "evidence_quality": "strong",
            }

        store = AgentRunStore()
        planner = PlanEngine(store)
        skill = ContentResearchSkill(research_runner=fake_research)
        orchestrator = AgentOrchestrator(
            run_store=store,
            event_bus=AgentEventBus(),
            tool_invoker=ToolInvoker(store),
            planner=planner,
            skills={skill.name: skill},
        )

        run = await orchestrator.create_run("帮我找一下英国春天标题素材", member_id="member-1")
        await orchestrator.wait_for_run(run["id"])
        snapshot = await store.get_run_snapshot(run["id"])

        plan_step = snapshot["steps"][0]
        self.assertEqual(plan_step["step_type"], "plan")
        self.assertEqual(plan_step["output_payload"]["intent"], "find_material")
        self.assertEqual(plan_step["output_payload"]["skill_chain"][0]["skill_name"], "content_research")
        self.assertFalse(plan_step["output_payload"]["cache_hit"])
        self.assertEqual(snapshot["run"]["plan"]["plan_version"], "planner-v1")


if __name__ == "__main__":
    unittest.main()
