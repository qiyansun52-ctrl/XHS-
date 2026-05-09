from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from discovery import derive_search_queries


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DiscoveryNotFoundError(Exception):
    pass


class DiscoveryService:
    def __init__(self, supabase_client, max_queries: int = 4):
        self.sb = supabase_client
        self.max_queries = max_queries

    def create_job(
        self,
        user_question: str,
        task_type: str,
        trigger_reason: str,
        internal_answer_payload: Dict[str, Any],
        search_queries: Optional[List[str]] = None,
        benchmark_account_ids: Optional[List[str]] = None,
        created_by_member_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        queries = (
            derive_search_queries(user_question, max_queries=self.max_queries)
            if search_queries is None
            else search_queries
        )
        payload = {
            "user_question": user_question,
            "task_type": task_type,
            "trigger_reason": trigger_reason,
            "internal_answer_payload": internal_answer_payload or {},
            "search_queries": queries[:self.max_queries],
            "benchmark_account_ids": benchmark_account_ids or [],
            "status": "pending",
            "created_by_member_id": created_by_member_id,
        }
        res = self.sb.table("external_discovery_jobs").insert([payload]).execute()
        rows = res.data or []
        return rows[0] if rows else payload

    def get_job_with_candidates(self, job_id: str) -> Dict[str, Any]:
        job_res = (
            self.sb.table("external_discovery_jobs")
            .select("*")
            .eq("id", job_id)
            .single()
            .execute()
        )
        if not job_res.data:
            raise DiscoveryNotFoundError("外部发现任务不存在")
        candidate_res = (
            self.sb.table("external_discovery_candidates")
            .select("*")
            .eq("job_id", job_id)
            .order("candidate_score", desc=True)
            .execute()
        )
        return {
            "job": job_res.data,
            "candidates": candidate_res.data or [],
        }

    def mark_candidate_review(
        self,
        candidate_id: str,
        review_status: str,
        review_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "review_status": review_status,
            "review_reason": review_reason,
            "reviewed_at": now_iso(),
        }
        res = (
            self.sb.table("external_discovery_candidates")
            .update(payload)
            .eq("id", candidate_id)
            .eq("review_status", "pending")
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise DiscoveryNotFoundError("候选素材不存在或已审核")
        return rows[0]
