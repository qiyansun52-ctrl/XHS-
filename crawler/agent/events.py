from __future__ import annotations

import asyncio
import copy
import json
from collections import defaultdict
from typing import Any, AsyncIterator, DefaultDict, Dict, List, Set

from .contracts import TERMINAL_EVENTS


class AgentEventBus:
    def __init__(self):
        self._history: DefaultDict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._subscribers: DefaultDict[str, Set[asyncio.Queue]] = defaultdict(set)

    def publish(self, run_id: str, event: str, data: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "event": event,
            "data": data,
        }
        self._history[run_id].append(copy.deepcopy(payload))
        for queue in list(self._subscribers[run_id]):
            queue.put_nowait(copy.deepcopy(payload))
        return payload

    def get_history(self, run_id: str) -> List[Dict[str, Any]]:
        return copy.deepcopy(self._history.get(run_id, []))

    async def stream_sse(self, run_id: str) -> AsyncIterator[str]:
        history = self.get_history(run_id)
        for item in history:
            yield self._format_event(item)
        if history and history[-1]["event"] in TERMINAL_EVENTS:
            return

        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[run_id].add(queue)
        try:
            while True:
                item = await queue.get()
                yield self._format_event(item)
                if item["event"] in TERMINAL_EVENTS:
                    break
        finally:
            self._subscribers[run_id].discard(queue)

    def _format_event(self, item: Dict[str, Any]) -> str:
        return f"event: {item['event']}\ndata: {json.dumps(item['data'], ensure_ascii=False)}\n\n"
