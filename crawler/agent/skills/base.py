from __future__ import annotations

from typing import Any, Dict, Protocol


class Skill(Protocol):
    name: str
    description: str
    declared_tools: list[str]
    typical_latency_ms: int

    async def run(self, input_payload: Dict[str, Any], ctx: Any = None) -> Dict[str, Any]:
        ...
