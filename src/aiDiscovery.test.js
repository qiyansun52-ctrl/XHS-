import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDiscoveryJobPayload,
  getDiscoveryPanelCopy,
  getDiscoveryTriggerReason,
  shouldAutoCreateDiscovery,
} from "./aiDiscovery.js";

test("getDiscoveryPanelCopy offers manual discovery even when evidence is strong", () => {
  const copy = getDiscoveryPanelCopy({
    question: "帮我找英国留学的素材",
    evidence_quality: "strong",
  });

  assert.equal(copy.title, "人工判定证据不够？继续外部发现");
  assert.equal(copy.buttonLabel, "证据不够，继续发现");
});

test("getDiscoveryPanelCopy explains zero-recall auto discovery", () => {
  const copy = getDiscoveryPanelCopy({
    question: "帮我找新加坡留学帖子",
    evidence_quality: "empty",
    can_external_discover: true,
  });

  assert.equal(copy.title, "无内部证据，已自动启动外部发现");
  assert.equal(copy.buttonLabel, "自动发现中");
});

test("getDiscoveryTriggerReason derives crawler reason from evidence quality", () => {
  assert.equal(getDiscoveryTriggerReason({ evidence_quality: "empty" }), "zero_recall");
  assert.equal(getDiscoveryTriggerReason({ sparse: true }), "sparse_recall");
  assert.equal(
    getDiscoveryTriggerReason({
      evidence_quality: "strong",
      discovery_trigger_reason: "sparse_recall",
    }),
    "sparse_recall",
  );
});

test("buildDiscoveryJobPayload marks manual triggers and lets backend derive queries", () => {
  const payload = buildDiscoveryJobPayload(
    {
      question: "帮我找英国留学的素材",
      task_type: "material",
      evidence_quality: "strong",
      conclusion: "内部证据看起来足够。",
    },
    "2026-05-10T08:00:00.000Z",
  );

  assert.equal(payload.trigger_reason, "user_requested");
  assert.equal(payload.search_queries, null);
  assert.equal(payload.internal_answer_payload.manual_external_discovery, true);
  assert.equal(payload.internal_answer_payload.evidence_quality_at_trigger, "strong");
  assert.equal(payload.internal_answer_payload.manual_triggered_at, "2026-05-10T08:00:00.000Z");
});

test("shouldAutoCreateDiscovery only auto-starts zero-recall discovery", () => {
  assert.equal(shouldAutoCreateDiscovery({
    evidence_quality: "empty",
    can_external_discover: true,
  }), true);
  assert.equal(shouldAutoCreateDiscovery({
    evidence_quality: "weak",
    can_external_discover: true,
  }), false);
  assert.equal(shouldAutoCreateDiscovery({
    evidence_quality: "empty",
    can_external_discover: false,
  }), false);
});
