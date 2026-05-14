import asyncio
import unittest

from agent.skills.content_research import ContentResearchSkill


class ContentResearchSkillTests(unittest.IsolatedAsyncioTestCase):
    async def test_strong_evidence_returns_answer_without_external_decision(self):
        async def fake_research(payload):
            await asyncio.sleep(0)
            return {
                "question": payload["question"],
                "conclusion": "内部素材足够回答。",
                "evidence_quality": "strong",
                "can_external_discover": False,
            }

        skill = ContentResearchSkill(research_runner=fake_research)

        result = await skill.run({
            "question": "英国春天标题素材",
            "intent": "find_material",
        })

        self.assertEqual(result["skill_name"], "content_research")
        self.assertEqual(result["evidence_quality"], "strong")
        self.assertEqual(result["answer"]["conclusion"], "内部素材足够回答。")
        self.assertEqual(result["external_discovery_decision"]["decision"], "skip")

    async def test_weak_evidence_records_sparse_external_discovery_decision(self):
        async def fake_research(payload):
            return {
                "question": payload["question"],
                "conclusion": "内部素材较少。",
                "evidence_quality": "weak",
                "can_external_discover": True,
                "discovery_trigger_reason": "sparse_recall",
            }

        skill = ContentResearchSkill(research_runner=fake_research)

        result = await skill.run({
            "question": "英国春天标题素材",
            "intent": "find_material",
        })

        self.assertEqual(result["evidence_quality"], "weak")
        self.assertEqual(result["external_discovery_decision"], {
            "decision": "propose",
            "reason": "sparse_recall",
        })

    async def test_empty_evidence_records_zero_recall_decision(self):
        async def fake_research(payload):
            return {
                "question": payload["question"],
                "conclusion": "知识库中没有匹配内容。",
                "evidence_quality": "empty",
                "can_external_discover": True,
                "discovery_trigger_reason": "zero_recall",
            }

        skill = ContentResearchSkill(research_runner=fake_research)

        result = await skill.run({
            "question": "英国春天标题素材",
            "intent": "find_material",
        })

        self.assertEqual(result["evidence_quality"], "empty")
        self.assertEqual(result["external_discovery_decision"], {
            "decision": "propose",
            "reason": "zero_recall",
        })


if __name__ == "__main__":
    unittest.main()
