from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from typing import Literal


AgentRunStatus = Literal["planning", "running", "completed", "failed"]
AgentStepType = Literal["plan", "tool_call", "answer", "observation", "decision"]

TERMINAL_RUN_STATUSES = {"completed", "failed"}
TERMINAL_EVENTS = {"run.completed", "run.failed"}


@dataclass
class SkillStep:
    skill_name: str
    inputs: Dict[str, Any]
    depends_on: List[str] = field(default_factory=list)
    parallel_with: List[str] = field(default_factory=list)
    optional: bool = False


@dataclass
class Plan:
    intent: str
    confidence: float
    skill_chain: List[SkillStep]
    estimated_latency_ms: int
    estimated_cost_usd: float
    requires_confirmation_at_end: bool
    plan_version: str
    cache_hit: bool = False
    cached_from_run_id: Optional[str] = None
    fallback_used: bool = False
    fallback_reason: Optional[str] = None


@dataclass
class SkillResult:
    skill_name: str
    output: Dict[str, Any]
    evidence_quality: str = "strong"
    status: str = "completed"
