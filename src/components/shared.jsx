// Shared constants, helpers, and UI primitives
import { useState, useEffect } from "react";

export function useIsMobile() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return width < 768;
}

export const STATUS = {
  draft:     { label: "草稿",   color: "#888",    bg: "rgba(136,136,136,0.12)" },
  scheduled: { label: "待发布", color: "#FF9F43", bg: "rgba(255,159,67,0.12)"  },
  published: { label: "已发布", color: "#26DE81", bg: "rgba(38,222,129,0.12)"  },
};

export const ROLE_LABELS = {
  operator: "运营",
  owner:    "主理人",
  admin:    "管理员",
};

export const PRESET_COLORS = [
  "#FF2442","#FF7A7A","#FF9F43","#54A0FF",
  "#A29BFE","#00CFCF","#26DE81","#FFC048",
  "#FF6B9D","#6C5CE7","#00B894","#FDCB6E",
];

export const FLAG_OPTIONS = [
  "🇬🇧","🇦🇺","🇨🇦","🇺🇸","🇨🇳","🌏","🇸🇬","🇳🇿","🇩🇪","🇫🇷","🇯🇵","🇰🇷",
];

export const fmt = (n) =>
  !n ? "0"
  : n >= 10000 ? (n / 10000).toFixed(1) + "w"
  : n >= 1000  ? (n / 1000).toFixed(1) + "k"
  : String(n);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const seedFn = (n, i) => Math.floor(n * (0.75 + ((n * 17 + i * 31) % 100) / 200));
export function getWeekly(acc) {
  return DAYS.map((day, i) => ({
    day,
    views: seedFn(Math.floor((acc.views || 0) / 30), i),
    likes: seedFn(Math.floor((acc.likes || 0) / 30), i + 7),
    saves: seedFn(Math.floor((acc.saves || 0) / 30), i + 14),
  }));
}

export function Avatar({ acc, size = 36 }) {
  const raw = acc?.avatar || "";
  const letter = (raw.startsWith("http") ? "" : raw) || acc?.name?.[0]?.toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: acc?.color || "#333",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, color: "#fff", flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

export function Badge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, color: s.color, background: s.bg,
      padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

export function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "#161616", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || "#fff", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{label}</div>
    </div>
  );
}

export const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#0d0d0d", border: "1px solid #2a2a2a",
  color: "#ddd", borderRadius: 8, padding: "9px 13px", fontSize: 13, outline: "none",
};

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "#888", marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}
