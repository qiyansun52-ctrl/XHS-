const VALID_TRIGGER_REASONS = new Set(["sparse_recall", "zero_recall", "user_requested"]);
const VALID_TASK_TYPES = new Set(["material", "experience", "image_reference", "mixed"]);

export function getEvidenceQuality(answer) {
  const quality = answer?.evidence_quality || (answer?.sparse ? "weak" : "strong");
  return ["empty", "weak", "strong"].includes(quality) ? quality : "strong";
}

export function isEvidenceInsufficient(answer) {
  return ["empty", "weak"].includes(getEvidenceQuality(answer));
}

export function shouldAutoCreateDiscovery(answer) {
  return getEvidenceQuality(answer) === "empty" && answer?.can_external_discover === true;
}

export function getDiscoveryTriggerReason(answer) {
  const triggerReason = answer?.discovery_trigger_reason;
  if (VALID_TRIGGER_REASONS.has(triggerReason)) {
    return triggerReason;
  }

  const evidenceQuality = getEvidenceQuality(answer);
  if (evidenceQuality === "empty") return "zero_recall";
  if (evidenceQuality === "weak") return "sparse_recall";
  return "user_requested";
}

export function getDiscoveryPanelCopy(answer) {
  if (getEvidenceQuality(answer) === "empty" && answer?.can_external_discover === true) {
    return {
      title: "无内部证据，已自动启动外部发现",
      description: "知识库没有匹配内容，系统会自动创建外部发现任务，让爬虫去小红书寻找候选素材。",
      buttonLabel: "自动发现中",
    };
  }

  if (isEvidenceInsufficient(answer)) {
    return {
      title: "证据不足，继续外部发现",
      description: "内部证据较少或没有命中，可以手动触发爬虫去发现新的对标内容线索。",
      buttonLabel: "触发爬虫发现",
    };
  }

  return {
    title: "人工判定证据不够？继续外部发现",
    description: "如果你觉得内部结果还不够，可以手动触发爬虫去小红书发现新候选素材，补充新的对标内容线索。",
    buttonLabel: "证据不够，继续发现",
  };
}

export function buildDiscoveryJobPayload(answer, triggeredAt = new Date().toISOString(), options = {}) {
  if (!answer) return null;

  const suggestedQueries = Array.isArray(answer.suggested_search_queries)
    ? answer.suggested_search_queries
    : [];
  const taskType = VALID_TASK_TYPES.has(answer.task_type) ? answer.task_type : "mixed";
  const autoTriggered = Boolean(options.autoTriggered);

  return {
    user_question: answer.question,
    task_type: taskType,
    trigger_reason: getDiscoveryTriggerReason(answer),
    internal_answer_payload: {
      ...answer,
      manual_external_discovery: !autoTriggered,
      auto_external_discovery: autoTriggered,
      manual_triggered_at: autoTriggered ? null : triggeredAt,
      auto_triggered_at: autoTriggered ? triggeredAt : null,
      evidence_quality_at_trigger: getEvidenceQuality(answer),
    },
    search_queries: suggestedQueries.length ? suggestedQueries : null,
    benchmark_account_ids: [],
  };
}
