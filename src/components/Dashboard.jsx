import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Eye, Heart, Bookmark, Users } from "lucide-react";
import { Avatar, StatPill, ChartTip, fmt, getWeekly } from "./shared.jsx";

export default function Dashboard({ accounts, selectedId, onSelect }) {
  const acc = accounts.find(a => a.id === selectedId) || accounts[0];
  const weekly = acc ? getWeekly(acc) : [];

  const totals = useMemo(() => ({
    followers: accounts.reduce((s, a) => s + (a.followers || 0), 0),
    views:     accounts.reduce((s, a) => s + (a.views || 0), 0),
    likes:     accounts.reduce((s, a) => s + (a.likes || 0), 0),
    saves:     accounts.reduce((s, a) => s + (a.saves || 0), 0),
  }), [accounts]);

  if (!acc) return <div style={{ padding: 32, color: "#555" }}>暂无账号数据</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>流量监控</h1>
        <p style={{ color: "#555", margin: "5px 0 0", fontSize: 13 }}>
          {accounts.length} 个账号 · 近7日数据（手动更新，接入 Spider_XHS 后自动同步）
        </p>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "总粉丝", value: fmt(totals.followers), icon: <Users size={14} />,    color: "#FF2442" },
          { label: "总浏览", value: fmt(totals.views),     icon: <Eye size={14} />,      color: "#FF9F43" },
          { label: "总点赞", value: fmt(totals.likes),     icon: <Heart size={14} />,    color: "#FF7A7A" },
          { label: "总收藏", value: fmt(totals.saves),     icon: <Bookmark size={14} />, color: "#A29BFE" },
        ].map(s => (
          <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ color: s.color, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              {s.icon}<span style={{ fontSize: 11, color: "#555" }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Account cards */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>账号详情</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {accounts.map(a => {
            const active = a.id === selectedId;
            return (
              <div key={a.id} onClick={() => onSelect(a.id)} style={{
                background: "#111", borderRadius: 12, padding: 18, cursor: "pointer",
                border: active ? `1px solid ${a.color}55` : "1px solid #1e1e1e",
                boxShadow: active ? `0 0 18px ${a.color}15` : "none",
                transition: "border-color 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Avatar acc={a} size={38} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{a.flag}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <StatPill label="粉丝"  value={fmt(a.followers)} color={a.color} />
                  <StatPill label="浏览"  value={fmt(a.views)} />
                  <StatPill label="点赞"  value={fmt(a.likes)} />
                  <StatPill label="收藏"  value={fmt(a.saves)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar acc={acc} size={30} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ddd" }}>{acc.name} — 近7日趋势</div>
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 12, color: "#555" }}>
            {[["#FF2442","浏览"], ["#FF9F43","点赞"], ["#A29BFE","收藏"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 2, background: c, borderRadius: 1 }} />{l}
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weekly} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e1e1e" />
            <XAxis dataKey="day" stroke="#333" tick={{ fontSize: 11, fill: "#555" }} />
            <YAxis stroke="#333" tick={{ fontSize: 11, fill: "#555" }} />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="views" name="浏览" stroke="#FF2442" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="likes" name="点赞" stroke="#FF9F43" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saves" name="收藏" stroke="#A29BFE" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
