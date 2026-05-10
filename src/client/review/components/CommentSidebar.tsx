import { useState } from "react";
import type { Mark } from "../../../shared/types.js";

interface Props {
  marks: Mark[];
  markdown: string;
  currentRevision: number;
  activeMarkId: string | null;
  role: string;
  onReply: (markId: string, text: string) => void;
  onResolve: (markId: string) => void;
  onAcceptSuggestion: (markId: string) => void;
  onRejectSuggestion: (markId: string) => void;
  onGlobalComment: (text: string) => void;
  onCommentClick: (markId: string) => void;
}

export function CommentSidebar({ marks, markdown, currentRevision, activeMarkId, role, onReply, onResolve, onAcceptSuggestion, onRejectSuggestion, onGlobalComment, onCommentClick }: Props) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [globalText, setGlobalText] = useState("");
  const [showGlobalInput, setShowGlobalInput] = useState(false);

  const filtered = marks.filter((m) => {
    if (filter === "open") return !m.resolved;
    if (filter === "resolved") return m.resolved;
    return true;
  });

  const handleReply = (markId: string) => {
    if (replyText.trim()) {
      onReply(markId, replyText.trim());
      setReplyText("");
      setReplyingTo(null);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid #e0e0e0",
              background: filter === f ? "#3b82f6" : "transparent",
              color: filter === f ? "#fff" : "#555",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Global comment input */}
      {showGlobalInput ? (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fefce8", borderRadius: "6px", border: "1px solid #fde047" }}>
          <p style={{ fontSize: "0.8rem", color: "#854d0e", marginBottom: "0.5rem", fontWeight: 500 }}>General feedback (not tied to specific text)</p>
          <textarea
            value={globalText}
            onChange={(e) => setGlobalText(e.target.value)}
            placeholder="Your general feedback on the document..."
            autoFocus
            style={{ width: "100%", minHeight: "60px", padding: "6px", borderRadius: "4px", border: "1px solid #d0d0d0", fontSize: "0.85rem" }}
          />
          <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
            <button
              onClick={() => { if (globalText.trim()) { onGlobalComment(globalText.trim()); setGlobalText(""); setShowGlobalInput(false); } }}
              disabled={!globalText.trim()}
              style={{ ...smallBtnStyle, opacity: globalText.trim() ? 1 : 0.5 }}
            >
              Post
            </button>
            <button onClick={() => { setShowGlobalInput(false); setGlobalText(""); }} style={{ ...smallBtnStyle, background: "#6b7280" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowGlobalInput(true)}
          style={{ width: "100%", marginBottom: "1rem", padding: "8px", borderRadius: "6px", border: "1px dashed #d0d0d0", background: "transparent", color: "#666", fontSize: "0.85rem", cursor: "pointer" }}
        >
          + Add general comment
        </button>
      )}

      {filtered.length === 0 && !showGlobalInput && (
        <p style={{ color: "#999", fontSize: "0.9rem", textAlign: "center", marginTop: "2rem" }}>
          No comments yet. Select text or add a general comment above.
        </p>
      )}

      {filtered.map((mark) => (
        <div
          key={mark.id}
          data-comment-id={mark.id}
          onClick={() => { if (!mark.resolved && mark.quote !== "[general]") onCommentClick(mark.id); }}
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            borderRadius: "6px",
            border: `1px solid ${mark.id === activeMarkId ? "#3b82f6" : mark.resolved ? "#d4edda" : "#e0e0e0"}`,
            background: mark.id === activeMarkId ? "#eff6ff" : mark.resolved ? "#f8fff8" : "#fff",
            opacity: mark.resolved ? 0.7 : 1,
            cursor: mark.resolved || mark.quote === "[general]" ? "default" : "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: mark.by.startsWith("ai:") ? "#7c3aed" : "#2563eb" }}>
              {mark.by.startsWith("ai:") ? "🤖 " : ""}{mark.by}
            </span>
            <span style={{ fontSize: "0.7rem", color: "#999" }}>
              {mark.type === "suggestion" ? "💡 suggestion" : "💬 comment"}
            </span>
          </div>

          {(() => {
            const isStale = mark.quote !== "[general]" && !markdown.includes(mark.quote);
            return (
              <div style={{ fontSize: "0.8rem", color: isStale ? "#b91c1c" : "#666", fontStyle: "italic", marginBottom: "0.5rem", padding: "4px 8px", background: isStale ? "#fef2f2" : "#f5f5f5", borderRadius: "3px", borderLeft: `3px solid ${isStale ? "#fca5a5" : "#ddd"}` }}>
                {mark.quote === "[general]" ? (
                  <span style={{ fontStyle: "normal", color: "#854d0e" }}>General feedback</span>
                ) : (
                  <>"{mark.quote.slice(0, 80)}{mark.quote.length > 80 ? "..." : ""}"</>
                )}
                {isStale && (
                  <span style={{ display: "block", fontSize: "0.7rem", color: "#dc2626", fontStyle: "normal", marginTop: "2px" }}>
                    ⚠ from rev {mark.revision} — text has changed
                  </span>
                )}
              </div>
            );
          })()}

          <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            {mark.type === "suggestion" ? mark.content : mark.text}
          </p>

          {mark.thread.length > 0 && (
            <div style={{ marginLeft: "1rem", borderLeft: "2px solid #e0e0e0", paddingLeft: "0.75rem" }}>
              {mark.thread.map((entry, i) => (
                <div key={i} style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: entry.by.startsWith("ai:") ? "#7c3aed" : "#2563eb" }}>
                    {entry.by}
                  </span>
                  <p style={{ fontSize: "0.85rem" }}>{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          {!mark.resolved && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              {replyingTo === mark.id ? (
                <div style={{ width: "100%" }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply..."
                    autoFocus
                    style={{ width: "100%", minHeight: "50px", padding: "6px", borderRadius: "4px", border: "1px solid #d0d0d0", fontSize: "0.85rem" }}
                  />
                  <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                    <button onClick={() => handleReply(mark.id)} style={smallBtnStyle}>Send</button>
                    <button onClick={() => setReplyingTo(null)} style={{ ...smallBtnStyle, background: "#6b7280" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={() => setReplyingTo(mark.id)} style={smallBtnStyle}>Reply</button>
                  {mark.type === "suggestion" && (role === "editor" || role === "owner") && (
                    <>
                      <button onClick={() => onAcceptSuggestion(mark.id)} style={{ ...smallBtnStyle, background: "#16a34a" }}>Accept</button>
                      <button onClick={() => onRejectSuggestion(mark.id)} style={{ ...smallBtnStyle, background: "#dc2626" }}>Reject</button>
                    </>
                  )}
                  {mark.type !== "suggestion" && (
                    <button onClick={() => onResolve(mark.id)} style={{ ...smallBtnStyle, background: "#16a34a" }}>Resolve</button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "4px",
  border: "none",
  background: "#3b82f6",
  color: "#fff",
  fontSize: "0.8rem",
  cursor: "pointer",
};
