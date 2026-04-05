import { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight,
  Eye, Heart, Bookmark, MessageCircle, Clock, User, Download,
} from "lucide-react";
import { supabase } from "../supabase.js";
import { Avatar, Badge, fmt, useIsMobile } from "./shared.jsx";

export default function PostDetailDrawer({ post, accounts, members, onClose, onStatusChange }) {
  const isMobile = useIsMobile();
  const [imageIdx, setImageIdx]     = useState(0);
  const [stats, setStats]           = useState(null);
  const [comments, setComments]     = useState([]);
  const [loadingStats, setLoading]  = useState(false);

  const acc      = accounts.find(a => a.id === (post?.account_id ?? post?.accountId));
  const uploader = members.find(m => m.id === post?.uploader_id);
  const images   = post?.images || [];

  // Reset image index when post changes
  useEffect(() => {
    setImageIdx(0);
    setStats(null);
    setComments([]);
  }, [post?.id]);

  // Load stats + comments when status is published
  useEffect(() => {
    if (!post?.id || post.status !== "published") return;
    loadStats();
    loadComments();
  }, [post?.id, post?.status]);

  const loadStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("post_stats").select("*").eq("post_id", post.id).single();
    setStats(data);
    setLoading(false);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments").select("*")
      .eq("post_id", post.id).order("created_at", { ascending: true });
    setComments(data || []);
  };

  const downloadImage = async (url, index) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = url.split(".").pop().split("?")[0] || "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${post.title}_${index + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("下载失败，请检查网络后重试");
    }
  };

  const downloadAll = async () => {
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i], i);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const changeStatus = async (newStatus) => {
    const { error } = await supabase.from("posts").update({ status: newStatus }).eq("id", post.id);
    if (error) { alert("状态更新失败: " + error.message); return; }
    onStatusChange(post.id, newStatus);
  };

  if (!post) return null;

  const scheduledLabel = post.scheduled_at || post.scheduledAt;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 300, backdropFilter: "blur(2px)",
      }} />

      {/* Drawer */}
      <div style={
        isMobile ? {
          position: "fixed", left: 0, right: 0, bottom: 0,
          height: "92dvh", background: "#111",
          borderTop: "1px solid #2a2a2a", borderRadius: "16px 16px 0 0",
          zIndex: 301, overflow: "auto", display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
        } : {
          position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
          background: "#111", borderLeft: "1px solid #2a2a2a",
          zIndex: 301, overflow: "auto", display: "flex", flexDirection: "column",
        }
      }>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #1e1e1e", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {acc && <Avatar acc={acc} size={32} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{acc?.name || "未知账号"}</div>
              <div style={{ marginTop: 3 }}><Badge status={post.status} /></div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {/* Image Carousel */}
          {images.length > 0 ? (
            <>
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 10, background: "#0d0d0d" }}>
                <img
                  src={images[imageIdx]} alt=""
                  style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", maxHeight: 360 }}
                />

                {/* Download current image — top-right */}
                <button
                  onClick={() => downloadImage(images[imageIdx], imageIdx)}
                  title="下载当前图片"
                  style={{
                    position: "absolute", top: 10, right: 10,
                    background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 8,
                    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#fff",
                  }}
                >
                  <Download size={15} />
                </button>

                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImageIdx(i => Math.max(0, i - 1))}
                      disabled={imageIdx === 0}
                      style={{
                        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                        background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: imageIdx === 0 ? "not-allowed" : "pointer", color: "#fff", opacity: imageIdx === 0 ? 0.4 : 1,
                      }}
                    ><ChevronLeft size={16} /></button>
                    <button
                      onClick={() => setImageIdx(i => Math.min(images.length - 1, i + 1))}
                      disabled={imageIdx === images.length - 1}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: imageIdx === images.length - 1 ? "not-allowed" : "pointer", color: "#fff",
                        opacity: imageIdx === images.length - 1 ? 0.4 : 1,
                      }}
                    ><ChevronRight size={16} /></button>
                    <div style={{
                      position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                      background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11,
                      padding: "3px 10px", borderRadius: 20,
                    }}>
                      {imageIdx + 1} / {images.length}
                    </div>
                    {/* Dot indicators */}
                    <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 4 }}>
                      {images.map((_, i) => (
                        <div key={i} onClick={() => setImageIdx(i)} style={{
                          width: 5, height: 5, borderRadius: "50%", cursor: "pointer",
                          background: i === imageIdx ? "#fff" : "rgba(255,255,255,0.3)",
                        }} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Download bar */}
              <div style={{
                display: "flex", gap: 8, marginBottom: 20,
              }}>
                <button
                  onClick={() => downloadImage(images[imageIdx], imageIdx)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "8px", background: "#161616", border: "1px solid #2a2a2a",
                    borderRadius: 8, color: "#ddd", fontSize: 12, cursor: "pointer",
                  }}
                >
                  <Download size={13} /> 下载当前图片
                </button>
                {images.length > 1 && (
                  <button
                    onClick={downloadAll}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      padding: "8px", background: "rgba(255,36,66,0.08)", border: "1px solid rgba(255,36,66,0.2)",
                      borderRadius: 8, color: "#FF2442", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    <Download size={13} /> 下载全部 {images.length} 张
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{
              borderRadius: 12, marginBottom: 20,
              background: acc?.color ? `${acc.color}18` : "#1a1a1a",
              height: 160, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#333", fontSize: 13,
            }}>
              暂无图片
            </div>
          )}

          {/* Title */}
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "0 0 10px" }}>{post.title}</h2>

          {/* Caption */}
          {post.caption && (
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.75, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>
              {post.caption}
            </p>
          )}

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {post.tags.map(t => (
                <span key={t} style={{
                  background: "rgba(255,36,66,0.1)", color: "#FF2442",
                  padding: "3px 10px", borderRadius: 20, fontSize: 12,
                }}>#{t}</span>
              ))}
            </div>
          )}

          {/* Meta */}
          {(scheduledLabel || uploader) && (
            <div style={{ padding: "12px 16px", background: "#0d0d0d", borderRadius: 10, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {scheduledLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666" }}>
                  <Clock size={13} /><span>预计发布：{scheduledLabel}</span>
                </div>
              )}
              {uploader && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666" }}>
                  <User size={13} /><span>上传人：{uploader.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Status actions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {post.status === "draft" && (
              <button onClick={() => changeStatus("scheduled")} style={{
                flex: 1, padding: "9px", background: "rgba(255,159,67,0.1)",
                color: "#FF9F43", border: "1px solid rgba(255,159,67,0.3)",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>排期发布</button>
            )}
            {post.status === "scheduled" && (
              <button onClick={() => changeStatus("published")} style={{
                flex: 1, padding: "9px", background: "rgba(38,222,129,0.1)",
                color: "#26DE81", border: "1px solid rgba(38,222,129,0.3)",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>标记已发布</button>
            )}
            {post.status !== "draft" && (
              <button onClick={() => changeStatus("draft")} style={{
                padding: "9px 16px", background: "rgba(136,136,136,0.1)",
                color: "#888", border: "1px solid rgba(136,136,136,0.2)",
                borderRadius: 8, fontSize: 13, cursor: "pointer",
              }}>撤回草稿</button>
            )}
          </div>

          {/* Stats — published only */}
          {post.status === "published" && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#444", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>数据表现</div>
              {loadingStats ? (
                <div style={{ color: "#444", fontSize: 13, padding: "12px 0" }}>加载中…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { label: "浏览", value: stats?.views    || 0, icon: <Eye size={14} />,         color: "#FF9F43" },
                    { label: "点赞", value: stats?.likes    || 0, icon: <Heart size={14} />,        color: "#FF7A7A" },
                    { label: "收藏", value: stats?.saves    || 0, icon: <Bookmark size={14} />,     color: "#A29BFE" },
                    { label: "评论", value: stats?.comments || 0, icon: <MessageCircle size={14} />, color: "#26DE81" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#0d0d0d", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
                      <div style={{ color: s.color, marginBottom: 5, display: "flex", justifyContent: "center" }}>{s.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt(s.value)}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments — published only */}
          {post.status === "published" && (
            <div>
              <div style={{ fontSize: 11, color: "#444", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
                评论 ({comments.length})
              </div>
              {comments.length === 0 ? (
                <div style={{ color: "#333", fontSize: 13, textAlign: "center", padding: "20px 0" }}>暂无评论记录</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ background: "#0d0d0d", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>{c.commenter || "匿名"}</span>
                        <span style={{ fontSize: 11, color: "#444" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("zh-CN") : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#888", lineHeight: 1.55 }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
