from __future__ import annotations

import hashlib
import json
from typing import Any, Awaitable, Callable, Dict


class ToolInvoker:
    def __init__(self, run_store):
        self.run_store = run_store

    async def invoke(
        self,
        tool_name: str,
        input_payload: Dict[str, Any],
        idempotency_key: str,
        fn: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        input_hash = hashlib.sha256(
            json.dumps(input_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        existing = await self.run_store.get_tool_invocation(idempotency_key)
        if existing and existing.get("status") == "completed":
            if existing.get("input_hash") != input_hash:
                raise RuntimeError(f"{tool_name} 调用 key 已被不同输入使用。")
            return {
                "cached": True,
                "output": existing.get("output_payload") or {},
            }
        if existing and existing.get("status") == "pending":
            raise RuntimeError(f"{tool_name} 调用仍在处理中，请稍后重试。")
        if existing and existing.get("input_hash") != input_hash:
            raise RuntimeError(f"{tool_name} 调用 key 已被不同输入使用。")

        if not existing:
            await self.run_store.create_tool_invocation(idempotency_key, tool_name, input_hash)

        try:
            output = await fn(input_payload)
        except Exception as exc:
            await self.run_store.complete_tool_invocation(
                idempotency_key,
                {"error": str(exc)},
                status="failed",
            )
            raise

        await self.run_store.complete_tool_invocation(idempotency_key, output)
        return {
            "cached": False,
            "output": output,
        }
