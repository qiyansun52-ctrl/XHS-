from __future__ import annotations

import copy
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_safe(value: Any) -> Any:
    try:
        json.dumps(value, ensure_ascii=False)
        return value
    except TypeError:
        return json.loads(json.dumps(value, ensure_ascii=False, default=str))


class ConversationStore:
    def __init__(self, supabase_client=None):
        self.sb = supabase_client
        self._conversations: Dict[str, Dict[str, Any]] = {}
        self._messages: Dict[str, List[Dict[str, Any]]] = {}
        self._contexts: Dict[str, Dict[str, Any]] = {}
        self._db_persistence_disabled = False

    async def create_conversation(
        self,
        title: str = "新对话",
        member_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        conversation_id = str(uuid.uuid4())
        created_at = now_iso()
        row = {
            "id": conversation_id,
            "title": title or "新对话",
            "member_id": member_id,
            "status": "active",
            "created_at": created_at,
            "updated_at": created_at,
            "archived_at": None,
        }
        context = self._empty_context(conversation_id)

        self._conversations[conversation_id] = row
        self._messages.setdefault(conversation_id, [])
        self._contexts[conversation_id] = context

        if self._can_persist():
            self._execute_persist(self.sb.table("ai_conversations").insert([json_safe(row)]))
            self._execute_persist(self.sb.table("ai_conversation_context").insert([json_safe(context)]))

        return copy.deepcopy(row)

    async def list_conversations(
        self,
        status: str = "active",
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        if self._can_persist():
            try:
                res = (
                    self.sb.table("ai_conversations")
                    .select("*")
                    .eq("status", status)
                    .order("updated_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                for row in res.data or []:
                    self._conversations[row["id"]] = dict(row)
                return copy.deepcopy(list(res.data or []))
            except Exception as exc:
                if self._is_missing_schema_error(exc):
                    self._disable_persistence(exc)
                else:
                    raise

        rows = [row for row in self._conversations.values() if row.get("status") == status]
        rows.sort(key=lambda row: row.get("updated_at") or "", reverse=True)
        return copy.deepcopy(rows[:limit])

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        message_type: str,
        content: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        conversation = self._conversations.get(conversation_id)
        if not conversation and self._can_persist():
            conversation = await self._load_conversation_from_db(conversation_id)
        if not conversation:
            raise KeyError(f"conversation not found: {conversation_id}")

        row = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "role": role,
            "message_type": message_type,
            "content": content or "",
            "payload": json_safe(payload or {}),
            "created_at": now_iso(),
        }
        self._messages.setdefault(conversation_id, []).append(row)

        updated_at = now_iso()
        conversation["updated_at"] = updated_at

        if self._can_persist():
            self._execute_persist(self.sb.table("ai_messages").insert([json_safe(row)]))
            self._execute_persist(
                self.sb.table("ai_conversations")
                .update({"updated_at": updated_at})
                .eq("id", conversation_id)
            )

        return copy.deepcopy(row)

    async def update_context(self, conversation_id: str, **fields) -> Dict[str, Any]:
        conversation = self._conversations.get(conversation_id)
        if not conversation and self._can_persist():
            conversation = await self._load_conversation_from_db(conversation_id)
        if not conversation:
            raise KeyError(f"conversation not found: {conversation_id}")

        context = self._contexts.get(conversation_id)
        if not context and self._can_persist():
            context = await self._load_context_from_db(conversation_id)
        if not context:
            context = self._empty_context(conversation_id)
            self._contexts[conversation_id] = context

        payload = json_safe(dict(fields))
        payload["updated_at"] = now_iso()
        context.update(payload)

        if self._can_persist():
            self._execute_persist(
                self.sb.table("ai_conversation_context")
                .update(json_safe(payload))
                .eq("conversation_id", conversation_id)
            )

        return copy.deepcopy(context)

    async def get_conversation_snapshot(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        conversation = self._conversations.get(conversation_id)
        messages = self._messages.get(conversation_id)
        context = self._contexts.get(conversation_id)

        if self._can_persist():
            if not conversation:
                conversation = await self._load_conversation_from_db(conversation_id)
            if messages is None:
                messages = await self._load_messages_from_db(conversation_id)
            if not context:
                context = await self._load_context_from_db(conversation_id)

        if not conversation:
            return None

        return {
            "conversation": copy.deepcopy(conversation),
            "messages": copy.deepcopy(messages or []),
            "context": copy.deepcopy(context or self._empty_context(conversation_id)),
        }

    def _empty_context(self, conversation_id: str) -> Dict[str, Any]:
        return {
            "conversation_id": conversation_id,
            "latest_answer_payload": {},
            "latest_crawler_brief": {},
            "active_discovery_job_id": None,
            "active_agent_run_id": None,
            "selected_candidate_ids": [],
            "pending_review_action_ids": [],
            "updated_at": now_iso(),
        }

    def _can_persist(self) -> bool:
        return bool(self.sb) and not self._db_persistence_disabled

    def _execute_persist(self, builder) -> None:
        if not self._can_persist():
            return
        try:
            builder.execute()
        except Exception as exc:
            if self._is_missing_schema_error(exc):
                self._disable_persistence(exc)
                return
            raise

    def _disable_persistence(self, exc: Exception) -> None:
        self._db_persistence_disabled = True
        log.warning("Conversation 持久化表未迁移，当前进程降级为内存态运行: %s", exc)

    def _is_missing_schema_error(self, exc: Exception) -> bool:
        text = str(exc).lower()
        return "pgrst205" in text or ("schema cache" in text and "could not find the table" in text)

    async def _load_conversation_from_db(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = (
                self.sb.table("ai_conversations")
                .select("*")
                .eq("id", conversation_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            if self._is_missing_schema_error(exc):
                self._disable_persistence(exc)
                return None
            raise
        if not res.data:
            return None
        self._conversations[conversation_id] = dict(res.data)
        return self._conversations[conversation_id]

    async def _load_messages_from_db(self, conversation_id: str) -> List[Dict[str, Any]]:
        try:
            res = (
                self.sb.table("ai_messages")
                .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at")
                .execute()
            )
        except Exception as exc:
            if self._is_missing_schema_error(exc):
                self._disable_persistence(exc)
                return []
            raise
        self._messages[conversation_id] = list(res.data or [])
        return self._messages[conversation_id]

    async def _load_context_from_db(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = (
                self.sb.table("ai_conversation_context")
                .select("*")
                .eq("conversation_id", conversation_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            if self._is_missing_schema_error(exc):
                self._disable_persistence(exc)
                return None
            raise
        if not res.data:
            return None
        self._contexts[conversation_id] = dict(res.data)
        return self._contexts[conversation_id]
