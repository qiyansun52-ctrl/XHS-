import { useState, useEffect } from "react";
import { Plus, X, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "../supabase.js";
import { inputStyle, useIsMobile } from "./shared.jsx";

const TOPIC_TAGS = ["申请时间线", "选校避坑", "语言备考", "offer晒单", "被拒复盘", "申请焦虑", "海外日常"];
const TAG_COLOR = {
  "申请时间线": "#54A0FF", "选校避坑": "#FF9F43", "语言备考": "#A29BFE",
  "offer晒单": "#26DE81", "被拒复盘": "#FF7A7A", "申请焦虑": "#FF2442", "海外日常": "#00CFCF",
};

const BENCH_COLS = [
  { key: "name",           label: "账号昵称",     required: true, width: 130 },
  { key: "destination",    label: "目的地方向",   width: 110 },
  { key: "content_type",   label: "主要内容类型", width: 130 },
  { key: "recent_data",    label: "近期数据",     width: 110 },
  { key: "note_direction", label: "好的笔记方向", width: 180 },
  { key: "consumer_words", label: "评论区消费词", width: 160 },
];

/* ── 通用空状态 ── */
function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: "40px 0", color: "#333", fontSize: 13 }}>{text}</div>;
}

/* ─────────────────────────────────
   Tab 1: 对标账号库
───────────────────────────────── */
function BenchmarkTab() {
  const isMobile = useIsMobile();
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("benchmark_accounts").select("*").order("created_at", { ascending: false });
    if (data) setRows(data);
    setLoading(false);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.name?.trim()) { alert("请填写账号昵称"); return; }
    setSaving(true);
    const payload = {};
    BENCH_COLS.forEach(c => { payload[c.key] = form[c.key]?.trim() || null; });
    const { data, error } = await supabase.from("benchmark_accounts").insert([payload]).select().single();
    setSaving(false);
    if (error) { alert("添加失败：" + error.message); return; }
    setRows(p => [data, ...p]);
    setForm({});
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("确定删除这条记录？")) return;
    const { error } = await supabase.from("benchmark_accounts").delete().eq("id", id);
    if (error) { alert("删除失败：" + error.message); return; }
    setRows(p => p.filter(r => r.id !== id));
  };

  if (loading) return <div style={{ color: "#444", padding: 24 }}>加载中…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowForm(p => !p)} style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "8px 16px", background: showForm ? "#333" : "#FF2442",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> 添加账号
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {BENCH_COLS.map(c => (
              <div key={c.key}>
                <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 5 }}>
                  {c.label}{c.required && " *"}
                </label>
                <input
                  value={form[c.key] || ""}
                  onChange={e => f(c.key, e.target.value)}
                  style={{ ...inputStyle, padding: "7px 10px" }}
                  placeholder={c.label}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowForm(false); setForm({}); }} style={{
              padding: "8px 16px", background: "transparent", border: "1px solid #2a2a2a",
              borderRadius: 7, color: "#666", fontSize: 13, cursor: "pointer",
            }}>取消</button>
            <button onClick={handleAdd} disabled={saving} style={{
              padding: "8px 16px", background: saving ? "#555" : "#FF2442",
              border: "none", borderRadius: 7, color: "#fff", fontSize: 13,
              fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? <Empty text="暂无对标账号，点击「添加账号」开始记录" /> : (
        isMobile ? (
          /* Mobile: card list */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(row => (
              <div key={row.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{row.name}</span>
                  <button onClick={() => handleDelete(row.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 2 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {BENCH_COLS.slice(1).map(c => row[c.key] && (
                  <div key={c.key} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#555", flexShrink: 0, width: 80 }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: "#bbb" }}>{row[c.key]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: table */
          <div style={{ border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0d0d0d" }}>
                    {BENCH_COLS.map(c => (
                      <th key={c.key} style={{
                        padding: "10px 14px", textAlign: "left", color: "#555",
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                        borderBottom: "1px solid #1e1e1e", whiteSpace: "nowrap",
                      }}>{c.label}</th>
                    ))}
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid #1e1e1e", width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? "#111" : "#0e0e0e" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#111" : "#0e0e0e"}
                    >
                      {BENCH_COLS.map(c => (
                        <td key={c.key} style={{
                          padding: "11px 14px", color: c.key === "name" ? "#e0e0e0" : "#888",
                          fontWeight: c.key === "name" ? 600 : 400,
                          borderBottom: "1px solid #1a1a1a", maxWidth: c.width,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{row[c.key] || <span style={{ color: "#2a2a2a" }}>—</span>}</td>
                      ))}
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid #1a1a1a", textAlign: "center" }}>
                        <button onClick={() => handleDelete(row.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#FF4444"}
                          onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ─────────────────────────────────
   Tab 2: 选题库
───────────────────────────────── */
function TopicsTab() {
  const isMobile = useIsMobile();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ description: "", tag: TOPIC_TAGS[0], reference_url: "" });
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("topics").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.description.trim()) { alert("请填写选题描述"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("topics").insert([{
      description: form.description.trim(),
      tag: form.tag,
      reference_url: form.reference_url.trim() || null,
    }]).select().single();
    setSaving(false);
    if (error) { alert("添加失败：" + error.message); return; }
    setItems(p => [data, ...p]);
    setForm({ description: "", tag: TOPIC_TAGS[0], reference_url: "" });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("确定删除？")) return;
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) { alert("删除失败：" + error.message); return; }
    setItems(p => p.filter(i => i.id !== id));
  };

  const filtered = filter === "全部" ? items : items.filter(i => i.tag === filter);

  if (loading) return <div style={{ color: "#444", padding: 24 }}>加载中…</div>;

  return (
    <div>
      {/* Filter + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["全部", ...TOPIC_TAGS].map(t => {
            const color = TAG_COLOR[t];
            const active = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1px solid ${active ? (color || "#FF2442") : "#2a2a2a"}`,
                background: active ? (color ? `${color}22` : "rgba(255,36,66,0.1)") : "transparent",
                color: active ? (color || "#FF2442") : "#555",
                fontWeight: active ? 600 : 400,
              }}>{t}</button>
            );
          })}
        </div>
        <button onClick={() => setShowForm(p => !p)} style={{
          display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          padding: "8px 16px", background: showForm ? "#333" : "#FF2442",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> 新增选题
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 5 }}>选题方向描述 *</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="描述这个选题方向的核心内容…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 5 }}>参考链接（可选）</label>
            <input value={form.reference_url} onChange={e => setForm(p => ({ ...p, reference_url: e.target.value }))}
              placeholder="https://www.xiaohongshu.com/explore/…" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 7 }}>类型标签</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TOPIC_TAGS.map(t => {
                const color = TAG_COLOR[t];
                const active = form.tag === t;
                return (
                  <button key={t} onClick={() => setForm(p => ({ ...p, tag: t }))} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${active ? color : "#2a2a2a"}`,
                    background: active ? `${color}22` : "transparent",
                    color: active ? color : "#555",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 16px", background: "transparent", border: "1px solid #2a2a2a",
              borderRadius: 7, color: "#666", fontSize: 13, cursor: "pointer",
            }}>取消</button>
            <button onClick={handleAdd} disabled={saving} style={{
              padding: "8px 16px", background: saving ? "#555" : "#FF2442",
              border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? <Empty text="暂无选题记录" /> : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
          {filtered.map(item => {
            const color = TAG_COLOR[item.tag] || "#555";
            return (
              <div key={item.id} style={{
                background: "#111", border: "1px solid #1e1e1e", borderRadius: 10,
                padding: "14px 16px", borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.65, margin: 0, flex: 1 }}>{item.description}</p>
                  <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#FF4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {item.reference_url && (
                  <a href={item.reference_url} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, color: "#FF2442", textDecoration: "none", marginTop: 8,
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <ExternalLink size={10} /> 查看参考帖子
                  </a>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 20,
                    background: `${color}18`, color: color, border: `1px solid ${color}44`,
                  }}>{item.tag}</span>
                  <span style={{ fontSize: 11, color: "#333" }}>
                    {new Date(item.created_at).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────
   Tab 3: 标题库
───────────────────────────────── */
function TitlesTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("titles").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!input.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("titles").insert([{ title: input.trim() }]).select().single();
    setSaving(false);
    if (error) { alert("添加失败：" + error.message); return; }
    setItems(p => [data, ...p]);
    setInput("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("确定删除？")) return;
    const { error } = await supabase.from("titles").delete().eq("id", id);
    if (error) { alert("删除失败：" + error.message); return; }
    setItems(p => p.filter(i => i.id !== id));
  };

  if (loading) return <div style={{ color: "#444", padding: 24 }}>加载中…</div>;

  return (
    <div>
      {/* Input row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="输入标题，按 Enter 或点击添加…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={handleAdd} disabled={saving || !input.trim()} style={{
          padding: "0 18px", background: input.trim() ? "#FF2442" : "#222",
          border: "none", borderRadius: 8, color: input.trim() ? "#fff" : "#444",
          fontSize: 13, fontWeight: 600, cursor: input.trim() ? "pointer" : "not-allowed",
          flexShrink: 0,
        }}>添加</button>
      </div>

      {items.length === 0 ? <Empty text="暂无标题记录" /> : (
        <div style={{ border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px",
              background: i % 2 === 0 ? "#111" : "#0e0e0e",
              borderBottom: i < items.length - 1 ? "1px solid #1a1a1a" : "none",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#161616"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#111" : "#0e0e0e"}
            >
              <span style={{ flex: 1, fontSize: 13, color: "#ddd", lineHeight: 1.5 }}>{item.title}</span>
              <span style={{ fontSize: 11, color: "#333", flexShrink: 0 }}>
                {new Date(item.created_at).toLocaleDateString("zh-CN")}
              </span>
              <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = "#FF4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: "#333", textAlign: "right" }}>{items.length} 条标题</div>
    </div>
  );
}

/* ─────────────────────────────────
   Tab 4: 违禁词记录
───────────────────────────────── */
function BannedWordsTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("banned_words").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    const word = input.trim();
    if (!word) return;
    if (items.some(i => i.word === word)) { alert("该词已存在"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("banned_words").insert([{ word }]).select().single();
    setSaving(false);
    if (error) { alert("添加失败：" + error.message); return; }
    setItems(p => [data, ...p]);
    setInput("");
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("banned_words").delete().eq("id", id);
    if (error) { alert("删除失败：" + error.message); return; }
    setItems(p => p.filter(i => i.id !== id));
  };

  if (loading) return <div style={{ color: "#444", padding: 24 }}>加载中…</div>;

  return (
    <div>
      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="输入违禁词，按 Enter 添加…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={handleAdd} disabled={saving || !input.trim()} style={{
          padding: "0 18px", background: input.trim() ? "#FF2442" : "#222",
          border: "none", borderRadius: 8, color: input.trim() ? "#fff" : "#444",
          fontSize: 13, fontWeight: 600, cursor: input.trim() ? "pointer" : "not-allowed",
          flexShrink: 0,
        }}>添加</button>
      </div>

      {items.length === 0 ? <Empty text="暂无违禁词记录" /> : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 20,
                background: "rgba(255,36,66,0.1)", border: "1px solid rgba(255,36,66,0.25)",
              }}>
                <span style={{ fontSize: 13, color: "#FF2442", fontWeight: 500 }}>{item.word}</span>
                <button onClick={() => handleDelete(item.id)} style={{
                  background: "none", border: "none", color: "rgba(255,36,66,0.5)",
                  cursor: "pointer", padding: 0, display: "flex", alignItems: "center",
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "#FF2442"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,36,66,0.5)"}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "#333" }}>{items.length} 个违禁词</div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────
   Tab 5: 爆款收藏
───────────────────────────────── */
const COUNTRIES = ["英国", "美国", "澳洲", "加拿大", "新加坡", "香港"];
const COUNTRY_COLOR = {
  "英国": "#FF7A7A", "美国": "#A29BFE", "澳洲": "#FF9F43",
  "加拿大": "#54A0FF", "新加坡": "#26DE81", "香港": "#FF2442",
};

function ViralPostsTab() {
  const isMobile = useIsMobile();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ url: "", note: "", country: COUNTRIES[0] });
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("viral_posts").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.url.trim()) { alert("请填写帖子链接"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("viral_posts").insert([{
      url: form.url.trim(),
      note: form.note.trim() || null,
      country: form.country,
    }]).select().single();
    setSaving(false);
    if (error) { alert("添加失败：" + error.message); return; }
    setItems(p => [data, ...p]);
    setForm({ url: "", note: "", country: COUNTRIES[0] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("确定删除？")) return;
    const { error } = await supabase.from("viral_posts").delete().eq("id", id);
    if (error) { alert("删除失败：" + error.message); return; }
    setItems(p => p.filter(i => i.id !== id));
  };

  const filtered = filter === "全部" ? items : items.filter(i => i.country === filter);

  if (loading) return <div style={{ color: "#444", padding: 24 }}>加载中…</div>;

  return (
    <div>
      {/* Filter + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["全部", ...COUNTRIES].map(c => {
            const color = COUNTRY_COLOR[c];
            const active = filter === c;
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1px solid ${active ? (color || "#FF2442") : "#2a2a2a"}`,
                background: active ? (color ? `${color}22` : "rgba(255,36,66,0.1)") : "transparent",
                color: active ? (color || "#FF2442") : "#555",
                fontWeight: active ? 600 : 400,
              }}>{c}</button>
            );
          })}
        </div>
        <button onClick={() => setShowForm(p => !p)} style={{
          display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          padding: "8px 16px", background: showForm ? "#333" : "#FF2442",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> 添加收藏
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 5 }}>帖子链接 *</label>
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://www.xiaohongshu.com/explore/…" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 5 }}>备注说明</label>
            <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="为什么觉得这条不错？" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#555", marginBottom: 7 }}>目的地标签</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTRIES.map(c => {
                const color = COUNTRY_COLOR[c];
                const active = form.country === c;
                return (
                  <button key={c} onClick={() => setForm(p => ({ ...p, country: c }))} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${active ? color : "#2a2a2a"}`,
                    background: active ? `${color}22` : "transparent",
                    color: active ? color : "#555",
                  }}>{c}</button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 16px", background: "transparent", border: "1px solid #2a2a2a",
              borderRadius: 7, color: "#666", fontSize: 13, cursor: "pointer",
            }}>取消</button>
            <button onClick={handleAdd} disabled={saving} style={{
              padding: "8px 16px", background: saving ? "#555" : "#FF2442",
              border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? <Empty text="暂无收藏帖子" /> : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
          {filtered.map(item => {
            const color = COUNTRY_COLOR[item.country] || "#555";
            return (
              <div key={item.id} style={{
                background: "#111", border: "1px solid #1e1e1e", borderRadius: 10,
                padding: "14px 16px", borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 13, color: "#FF2442", textDecoration: "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <ExternalLink size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.url}</span>
                  </a>
                  <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#FF4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {item.note && (
                  <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px", lineHeight: 1.55 }}>{item.note}</p>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 20,
                    background: `${color}18`, color: color, border: `1px solid ${color}44`,
                  }}>{item.country}</span>
                  <span style={{ fontSize: 11, color: "#333" }}>
                    {new Date(item.created_at).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────
   主组件
───────────────────────────────── */
const TABS = ["对标账号库", "选题库", "标题库", "违禁词记录", "爆款收藏"];

export default function MaterialPage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(0);

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>素材库</h1>
        <p style={{ color: "#555", fontSize: 13, margin: "5px 0 0" }}>对标账号、选题方向、标题灵感、违禁词、爆款收藏</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 24,
        background: "#0d0d0d", border: "1px solid #1e1e1e",
        borderRadius: 10, padding: 4,
        overflowX: "auto",
      }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            flex: isMobile ? "0 0 auto" : 1,
            padding: isMobile ? "8px 14px" : "9px 0",
            borderRadius: 7, border: "none", cursor: "pointer",
            background: tab === i ? "#1a1a1a" : "transparent",
            color: tab === i ? "#e0e0e0" : "#555",
            fontSize: 13, fontWeight: tab === i ? 600 : 400,
            whiteSpace: "nowrap",
            transition: "all 0.1s",
          }}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && <BenchmarkTab />}
      {tab === 1 && <TopicsTab />}
      {tab === 2 && <TitlesTab />}
      {tab === 3 && <BannedWordsTab />}
      {tab === 4 && <ViralPostsTab />}
    </div>
  );
}
