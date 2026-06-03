import { useState, useEffect } from "react";
import { authHeaders } from "../../shared/auth.js";

interface PresenceEntry {
  id: string;
  name: string;
  role: string;
  status?: string;
}

interface Props {
  slug: string;
  token: string;
  code: string;
  participantId: string;
  participantName: string;
}

export function PresenceBar({ slug, token, code, participantId, participantName }: Props) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Announce our presence whenever identity changes.
  useEffect(() => {
    fetch(`/documents/${slug}/presence`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ id: participantId, name: participantName, role: "viewer" }),
    }).catch(() => {});
  }, [slug, token, code, participantId, participantName]);

  // Poll the roster on a stable interval; not affected by our own name changes.
  useEffect(() => {
    const fetchPresence = () => {
      fetch(`/documents/${slug}/presence`, {
        headers: authHeaders(token, code),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setPresence(d.presence || []); })
        .catch(() => {});
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 5000);
    return () => clearInterval(interval);
  }, [slug, token, code]);

  const copyBridgeUrl = () => {
    const base = `${window.location.origin}/documents/${slug}`;
    const snippet = [
      `# Specsync Agent Bridge`,
      ``,
      `Connect your agent to review and comment on this document.`,
      ``,
      `## Connection`,
      ``,
      `- Base URL: ${base}`,
      `- Auth: every request below requires two headers —`,
      `    x-share-token: ${token}`,
      `    x-join-code: ${code}`,
      ``,
      `## Identity`,
      ``,
      `Pick a unique codename: ai:<agent>-<adjective>-<noun> (e.g. ai:claude-quiet-meadow).`,
      `Use a random adjective-noun pair so agents don't collide, and reuse it in every`,
      `"by" field and presence signal.`,
      ``,
      `## Steps`,
      ``,
      `1. Announce your presence:`,
      `   POST ${base}/presence`,
      `   {"id":"ai:<you>","name":"<Display Name>","role":"commenter"}`,
      ``,
      `2. Read the current document:`,
      `   GET ${base}/state`,
      ``,
      `3. Poll for new activity every 5s (advance since to the last id you saw):`,
      `   GET ${base}/events/pending?since=0&exclude_by=ai:*`,
      ``,
      `4. Reply to a comment:`,
      `   POST ${base}/ops`,
      `   {"type":"comment.reply","markId":"<id>","by":"ai:<you>","text":"<reply>"}`,
      ``,
      `5. Add a new comment:`,
      `   POST ${base}/ops`,
      `   {"type":"comment.add","by":"ai:<you>","quote":"<text from doc>","text":"<comment>"}`,
      ``,
      `6. Suggest an edit (propose replacement text):`,
      `   POST ${base}/ops`,
      `   {"type":"suggestion.add","by":"ai:<you>","quote":"<text from doc>","content":"<replacement>"}`,
      ``,
      `Never approve — only humans approve.`,
    ].join("\n");
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.4rem 1.5rem",
        borderBottom: "1px solid #f0f0f0",
        background: "#fafafa",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
        {presence.length === 0 && (
          <span style={{ color: "#999" }}>No one else viewing</span>
        )}
        {[...presence]
          .sort((a, b) => Number(b.id === participantId) - Number(a.id === participantId))
          .map((p) => {
            const isAgent = p.id.startsWith("ai:");
            return (
            <span
              key={p.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "2px 8px",
                borderRadius: "12px",
                background: isAgent ? "#f3e8ff" : "#e0f2fe",
                color: isAgent ? "#7c3aed" : "#0369a1",
                fontSize: "0.75rem",
                fontWeight: 500,
              }}
            >
              {isAgent && "🤖 "}
              {p.name}{p.id === participantId && " (you)"}
              {p.status && <span style={{ opacity: 0.7 }}> · {p.status}</span>}
            </span>
          );
        })}
      </div>

      <button
        onClick={copyBridgeUrl}
        style={{
          padding: "4px 10px",
          borderRadius: "4px",
          border: "1px solid #e0e0e0",
          background: copied ? "#dcfce7" : "#fff",
          color: copied ? "#166534" : "#555",
          fontSize: "0.75rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied!" : "📋 Copy Bridge URL"}
      </button>
    </div>
  );
}
