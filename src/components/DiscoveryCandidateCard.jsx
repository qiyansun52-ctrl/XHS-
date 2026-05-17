const DISCOVERY_SOURCE_PATH_LABELS = {
  benchmark_expansion: "对标账号扩展",
};

export default function DiscoveryCandidateCard({ candidate, onReview, isReviewing }) {
  const reviewStatus = candidate.review_status || "pending";
  const statusLabel = {
    pending: "待处理",
    ignored: "已忽略",
    rejected: "已标记不相关",
    approved: "已入库",
  }[reviewStatus] || reviewStatus;
  const isReviewed = reviewStatus !== "pending";
  const isActionDisabled = isReviewed || isReviewing;
  const isApproved = reviewStatus === "approved";
  const sourcePathLabel = DISCOVERY_SOURCE_PATH_LABELS[candidate.source_path] || "关键词搜索";
  const detailText = candidate.caption || candidate.ai_reason || "暂无摘要，建议打开原始链接人工判断。";

  return (
    <div style={{
      background: "#0d0d0d",
      border: "1px solid #222",
      borderRadius: 10,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          {candidate.cover_image && (
            <img
              src={candidate.cover_image}
              alt=""
              style={{
                width: 58,
                height: 58,
                borderRadius: 8,
                objectFit: "cover",
                border: "1px solid #222",
                background: "#111",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0", lineHeight: 1.45 }}>
              {candidate.title || candidate.account_name || "未命名候选素材"}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 5 }}>
              {sourcePathLabel} · {candidate.platform || "外部来源"} · 候选分 {candidate.candidate_score ?? "-"}
            </div>
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          fontSize: 10,
          color: isApproved ? "#26DE81" : isReviewed ? "#666" : "#FF9F43",
          background: isApproved ? "rgba(38,222,129,0.08)" : isReviewed ? "#151515" : "rgba(255,159,67,0.08)",
          border: `1px solid ${isApproved ? "rgba(38,222,129,0.2)" : isReviewed ? "#242424" : "rgba(255,159,67,0.18)"}`,
          borderRadius: 999,
          padding: "3px 8px",
        }}>
          {statusLabel}
        </span>
      </div>

      <div style={{
        fontSize: 12,
        color: "#888",
        lineHeight: 1.65,
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {detailText}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#444" }}>
        {candidate.likes != null && <span>赞 {candidate.likes}</span>}
        {candidate.saves != null && <span>藏 {candidate.saves}</span>}
        {candidate.comments != null && <span>评 {candidate.comments}</span>}
        {candidate.author_name && <span>{candidate.author_name}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {candidate.url && (
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: "#54A0FF", textDecoration: "none", marginRight: "auto" }}
          >
            打开外部链接
          </a>
        )}
        <button
          type="button"
          disabled={isActionDisabled}
          onClick={() => onReview(candidate, "approve")}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid rgba(38,222,129,0.25)",
            background: "rgba(38,222,129,0.08)",
            color: isActionDisabled ? "#444" : "#26DE81",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          {isReviewing ? "处理中…" : "通过并入库"}
        </button>
        <button
          type="button"
          disabled={isActionDisabled}
          onClick={() => onReview(candidate, "ignore")}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #2a2a2a",
            background: "transparent",
            color: isActionDisabled ? "#444" : "#aaa",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          {isReviewing ? "处理中…" : "忽略"}
        </button>
        <button
          type="button"
          disabled={isActionDisabled}
          onClick={() => onReview(candidate, "reject")}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,36,66,0.25)",
            background: "rgba(255,36,66,0.06)",
            color: isActionDisabled ? "#444" : "#FF2442",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          不相关
        </button>
      </div>
    </div>
  );
}
