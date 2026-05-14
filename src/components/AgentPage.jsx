import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { createAgentRun, getAgentRun, subscribeAgentRunEvents } from "../agentApi.js";
import { inputStyle, useIsMobile } from "./shared.jsx";

const STEP_LABELS = {
  plan: "理解任务",
  tool_call: "内部检索",
  answer: "整理回答",
  observation: "记录观察",
  decision: "做出决策",
};

const STEP_STATUS_STYLES = {
  pending: { color: "#FF9F43", background: "rgba(255,159,67,0.08)", border: "rgba(255,159,67,0.18)" },
  completed: { color: "#26DE81", background: "rgba(38,222,129,0.08)", border: "rgba(38,222,129,0.18)" },
  failed: { color: "#FF5C7A", background: "rgba(255,36,66,0.08)", border: "rgba(255,36,66,0.18)" },
};

const EVIDENCE_STYLES = {
  empty: { label: "无可用内部证据", color: "#FF5C7A", background: "rgba(255,36,66,0.08)", border: "rgba(255,36,66,0.18)" },
  weak: { label: "内部证据较少", color: "#FF9F43", background: "rgba(255,159,67,0.08)", border: "rgba(255,159,67,0.18)" },
  strong: { label: "内部证据充足", color: "#26DE81", background: "rgba(38,222,129,0.08)", border: "rgba(38,222,129,0.18)" },
};

function SectionCard({ title, children }) {
  return (
    <section style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#777", marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function mergeStepList(prev, nextStep) {
  const index = prev.findIndex(step => step.id === nextStep.id);
  if (index === -1) {
    return [...prev, nextStep].sort((a, b) => (a.step_index || 0) - (b.step_index || 0));
  }

  return prev.map(step => (step.id === nextStep.id ? nextStep : step));
}

function TimelineStep({ step }) {
  const style = STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.pending;
  const answer = step.output_payload?.final_answer || step.output_payload?.answer || step.output_payload || {};
  const skillChain = (step.output_payload?.skill_chain || [])
    .map(item => item.skill_name || item)
    .join(" -> ");

  return (
    <div style={{ position: "relative", paddingLeft: 22 }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: 6,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: style.color,
        boxShadow: `0 0 0 4px ${style.background}`,
      }} />
      <div style={{
        background: "#0d0d0d",
        border: "1px solid #1e1e1e",
        borderRadius: 10,
        padding: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#e8e8e8", fontWeight: 700 }}>
            {STEP_LABELS[step.step_type] || step.step_type}
          </div>
          <span style={{
            fontSize: 10,
            color: style.color,
            background: style.background,
            border: `1px solid ${style.border}`,
            borderRadius: 999,
            padding: "3px 8px",
            flexShrink: 0,
          }}>
            {step.status === "completed" ? "已完成" : step.status === "failed" ? "失败" : "进行中"}
          </span>
        </div>

        {step.step_type === "plan" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#888", lineHeight: 1.7 }}>
            意图：{step.output_payload?.intent || "general_qa"} · Skill：{skillChain || "content_research"}
            {step.output_payload?.fallback_used ? " · 已启用低延迟方案" : ""}
            {step.output_payload?.cache_hit ? " · 命中历史计划" : ""}
          </div>
        )}

        {step.step_type === "tool_call" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#888", lineHeight: 1.7 }}>
            {answer?.conclusion || "正在从内部知识库筛选证据。"}
          </div>
        )}

        {step.step_type === "answer" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#888", lineHeight: 1.7 }}>
            {step.output_payload?.final_answer?.conclusion || "回答已整理完成。"}
          </div>
        )}

        {step.error_message && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#FF5C7A", lineHeight: 1.6 }}>
            {step.error_message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const isMobile = useIsMobile();
  const streamRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [currentRun, setCurrentRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    return () => {
      streamRef.current?.abort();
    };
  }, []);

  const syncSnapshot = async runId => {
    const snapshot = await getAgentRun(runId);
    setCurrentRun(snapshot.run);
    setSteps(snapshot.steps || []);
  };

  const handleEvent = async payload => {
    setEvents(prev => [...prev.slice(-19), payload]);
    const { event, data } = payload;

    if (data?.step) {
      setSteps(prev => mergeStepList(prev, data.step));
    }

    if (event === "run.completed" || event === "run.failed") {
      setCurrentRun(prev => ({
        ...(prev || {}),
        id: data.run_id || prev?.id,
        status: data.status || prev?.status,
        final_answer: data.final_answer || prev?.final_answer,
        error_message: data.error_message || prev?.error_message || null,
      }));
      if (data.run_id) {
        try {
          await syncSnapshot(data.run_id);
        } catch (snapshotError) {
          setError(snapshotError.message || "同步运营助手结果失败，请手动刷新后再试。");
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || creating) return;

    streamRef.current?.abort();
    setCreating(true);
    setError("");
    setEvents([]);
    setSteps([]);
    setCurrentRun(null);

    try {
      const created = await createAgentRun({ message: prompt.trim() });
      setCurrentRun(created.run);
      setSteps(created.steps || []);
      streamRef.current = subscribeAgentRunEvents(created.run.id, {
        onEvent: handleEvent,
        onError: streamError => setError(streamError.message || "运营助手进度已中断，请稍后重试。"),
        onDone: () => {
          streamRef.current = null;
        },
      });
    } catch (submitError) {
      setError(submitError.message || "创建运营助手任务失败，请稍后重试。");
    } finally {
      setCreating(false);
    }
  };

  const answer = currentRun?.final_answer || null;
  const evidence = EVIDENCE_STYLES[answer?.evidence_quality || "strong"] || EVIDENCE_STYLES.strong;

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="任务入口">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(255,36,66,0.16), rgba(255,159,67,0.14))",
            border: "1px solid rgba(255,36,66,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FF2442",
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>运营助手</div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 3 }}>
              先从团队资料找依据，再整理成可追踪的建议。
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            placeholder="例如：找最近适合英国留学账号的春天标题素材"
            style={{
              ...inputStyle,
              minHeight: isMobile ? 120 : 110,
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
              适合找素材、拆方向、整理账号历史经验。
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating || !prompt.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                border: "none",
                borderRadius: 10,
                background: creating ? "#333" : "#FF2442",
                color: "#fff",
                cursor: creating ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {creating ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              {creating ? "启动中…" : "开始研究"}
            </button>
          </div>
        </div>
      </SectionCard>

      {error && (
        <div style={{
          background: "rgba(255,36,66,0.08)",
          border: "1px solid rgba(255,36,66,0.18)",
          borderRadius: 10,
          padding: 12,
          color: "#FF5C7A",
          fontSize: 12,
          lineHeight: 1.65,
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
        gap: 16,
        alignItems: "start",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="当前任务">
            {!currentRun && (
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>
                还没有运行中的任务。开始研究后，这里会展示状态、证据质量和最终回答。
              </div>
            )}

            {currentRun && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bot size={16} color="#FF2442" />
                    <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>
                      任务 {currentRun.id?.slice(0, 8)}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: currentRun.status === "failed" ? "#FF5C7A" : currentRun.status === "completed" ? "#26DE81" : "#FF9F43",
                    background: currentRun.status === "failed" ? "rgba(255,36,66,0.08)" : currentRun.status === "completed" ? "rgba(38,222,129,0.08)" : "rgba(255,159,67,0.08)",
                    border: `1px solid ${currentRun.status === "failed" ? "rgba(255,36,66,0.18)" : currentRun.status === "completed" ? "rgba(38,222,129,0.18)" : "rgba(255,159,67,0.18)"}`,
                    borderRadius: 999,
                    padding: "4px 9px",
                  }}>
                    {currentRun.status === "completed" ? "已完成" : currentRun.status === "failed" ? "失败" : "运行中"}
                  </span>
                </div>

                <div style={{
                  background: evidence.background,
                  border: `1px solid ${evidence.border}`,
                  borderRadius: 10,
                  padding: 12,
                  color: evidence.color,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{evidence.label}</div>
                  <div style={{ fontSize: 11, color: "#777", lineHeight: 1.6 }}>
                    {answer?.trace_id ? `追踪号 ${answer.trace_id.slice(0, 8)}` : "回答完成后会显示证据质量和追踪号。"}
                  </div>
                </div>

                {answer?.conclusion && (
                  <div style={{ fontSize: 14, color: "#e8e8e8", lineHeight: 1.8 }}>
                    {answer.conclusion}
                  </div>
                )}

                {answer?.recommendations?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {answer.recommendations.map((item, index) => (
                      <div key={index} style={{
                        background: "#0d0d0d",
                        border: "1px solid #1e1e1e",
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13,
                        color: "#ddd",
                        lineHeight: 1.65,
                      }}>
                        {item.text}
                      </div>
                    ))}
                  </div>
                )}

                {currentRun.error_message && (
                  <div style={{ fontSize: 12, color: "#FF5C7A", lineHeight: 1.6 }}>
                    {currentRun.error_message}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="任务进度">
            {steps.length === 0 ? (
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>
                开始研究后，这里会依次显示理解任务、内部检索和整理回答。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {steps.map(step => (
                  <TimelineStep key={step.id} step={step} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="运行记录">
            {events.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                任务启动后，这里会记录每一步的状态变化。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {events.map((item, index) => (
                  <div key={`${item.event}-${index}`} style={{
                    fontSize: 12,
                    color: "#888",
                    background: "#0d0d0d",
                    border: "1px solid #1e1e1e",
                    borderRadius: 8,
                    padding: "9px 10px",
                  }}>
                    <span style={{ color: "#FF9F43" }}>{item.event}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
