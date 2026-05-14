from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Dict, Optional

from .planning import PlanEngine, plan_to_dict
from .skills.content_research import ContentResearchSkill


class AgentOrchestrator:
    def __init__(
        self,
        run_store,
        event_bus,
        tool_invoker,
        research_runner: Optional[Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None,
        planner: Optional[PlanEngine] = None,
        skills: Optional[Dict[str, Any]] = None,
    ):
        self.run_store = run_store
        self.event_bus = event_bus
        self.tool_invoker = tool_invoker
        self.planner = planner or PlanEngine(run_store)
        if skills is not None:
            self.skills = skills
        elif research_runner is not None:
            skill = ContentResearchSkill(research_runner)
            self.skills = {skill.name: skill}
        else:
            self.skills = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    async def create_run(
        self,
        user_message: str,
        user_image_url: Optional[str] = None,
        member_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        run = await self.run_store.create_run(
            user_message=user_message,
            user_image_url=user_image_url,
            member_id=member_id,
        )
        self.event_bus.publish(run["id"], "run.created", {"run_id": run["id"], "status": run["status"]})
        task = asyncio.create_task(self._execute_run(run["id"], user_message, user_image_url, member_id))
        self._tasks[run["id"]] = task
        return run

    async def wait_for_run(self, run_id: str) -> None:
        task = self._tasks.get(run_id)
        if task:
            await task

    async def _execute_run(
        self,
        run_id: str,
        user_message: str,
        user_image_url: Optional[str],
        member_id: Optional[str],
    ) -> None:
        tool_step = None
        try:
            await self.run_store.update_run(run_id, status="running")

            plan = await self.planner.create_plan(
                question=user_message,
                member_id=member_id,
                image_url=user_image_url,
            )
            plan_payload = plan_to_dict(plan)
            plan_step = await self.run_store.create_step(
                run_id=run_id,
                step_type="plan",
                input_payload={"message": user_message},
            )
            self.event_bus.publish(run_id, "step.created", {"step": plan_step})
            plan_step = await self.run_store.complete_step(
                run_id=run_id,
                step_id=plan_step["id"],
                output_payload=plan_payload,
            )
            await self.run_store.update_run(run_id, plan=plan_payload)
            self.event_bus.publish(run_id, "step.completed", {"step": plan_step})

            skill_result = None
            for skill_step in plan.skill_chain:
                skill = self.skills.get(skill_step.skill_name)
                if not skill:
                    raise RuntimeError(f"未注册 Agent skill：{skill_step.skill_name}")

                tool_input = dict(skill_step.inputs)
                tool_step = await self.run_store.create_step(
                    run_id=run_id,
                    step_type="tool_call",
                    tool_name=skill_step.skill_name,
                    input_payload=tool_input,
                )
                self.event_bus.publish(run_id, "step.created", {"step": tool_step})
                tool_result = await self.tool_invoker.invoke(
                    tool_name=skill_step.skill_name,
                    input_payload=tool_input,
                    idempotency_key=f"{run_id}:{tool_step['id']}",
                    fn=skill.run,
                )
                skill_result = tool_result["output"]
                tool_step = await self.run_store.complete_step(
                    run_id=run_id,
                    step_id=tool_step["id"],
                    output_payload=skill_result,
                )
                self.event_bus.publish(run_id, "step.completed", {"step": tool_step})

            if skill_result is None:
                raise RuntimeError("Agent plan 没有可执行的 skill")

            final_answer = skill_result.get("answer") or skill_result
            tool_step = await self.run_store.create_step(
                run_id=run_id,
                step_type="answer",
                input_payload={"skill_name": skill_result.get("skill_name")},
            )
            self.event_bus.publish(run_id, "step.created", {"step": tool_step})
            answer_step = await self.run_store.complete_step(
                run_id=run_id,
                step_id=tool_step["id"],
                output_payload={"final_answer": final_answer},
            )
            self.event_bus.publish(run_id, "step.completed", {"step": answer_step})

            run = await self.run_store.update_run(
                run_id,
                status="completed",
                final_answer=final_answer,
                completed_at=answer_step["completed_at"],
            )
            await self.planner.record_completed_run(
                question=user_message,
                member_id=member_id,
                run_id=run_id,
                plan=plan,
                evidence_quality=final_answer.get("evidence_quality") or "strong",
            )
            self.event_bus.publish(
                run_id,
                "run.completed",
                {
                    "run_id": run_id,
                    "status": run["status"],
                    "final_answer": final_answer,
                },
            )
        except Exception as exc:
            if tool_step:
                await self.run_store.complete_step(
                    run_id=run_id,
                    step_id=tool_step["id"],
                    status="failed",
                    error_message=str(exc),
                )
            run = await self.run_store.update_run(run_id, status="failed", error_message=str(exc))
            self.event_bus.publish(
                run_id,
                "run.failed",
                {
                    "run_id": run_id,
                    "status": run["status"],
                    "error_message": str(exc),
                },
            )
