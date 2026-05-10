import { useState, useEffect } from "react";

interface PresenceEntry {
  id: string;
  name: string;
  role: string;
  status?: string;
}

interface Props {
  slug: string;
  token: string;
  participantId: string;
  participantName: string;
}

export function PresenceBar({ slug, token, participantId, participantName }: Props) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/documents/${slug}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": token },
      body: JSON.stringify({ id: participantId, name: participantName, role: "viewer" }),
    }).catch(() => {});

    const fetchPresence = () => {
      fetch(`/documents/${slug}/presence`, {
        headers: { "x-share-token": token },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setPresence(d.presence || []); })
        .catch(() => {});
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 5000);
    return () => clearInterval(interval);
  }, [slug, token, participantId, participantName]);

  const copyBridgeUrl = () => {
    const baseUrl = window.location.origin;
    const snippet = [
      `# Specsync Agent Bridge`,
      ``,
      `Connect your agent to review and comment on this document.`,
      ``,
      `## Connection Details`,
      ``,
      `- Server: ${baseUrl}`,
      `- Document: ${slug}`,
      `- Token: ${token}`,
      ``,
      `## How to Participate`,
      ``,
      `1. Read the current document state:`,
      `   GET ${baseUrl}/documents/${slug}/state`,
      `   Header: x-share-token: ${token}`,
      ``,
      `2. Poll for new comments/events:`,
      `   GET ${baseUrl}/documents/${slug}/events/pending?since=0&exclude_by=ai:*`,
      `   Header: x-share-token: ${token}`,
      ``,
      `3. Reply to a comment:`,
      `   POST ${baseUrl}/documents/${slug}/ops`,
      `   Header: x-share-token: ${token}`,
      `   Body: {"type":"comment.reply","markId":"<id>","by":"ai:<your-agent-name>","text":"<reply>"}`,
      ``,
      `4. Add a new comment:`,
      `   POST ${baseUrl}/documents/${slug}/ops`,
      `   Header: x-share-token: ${token}`,
      `   Body: {"type":"comment.add","by":"ai:<your-agent-name>","quote":"<text from doc>","text":"<comment>"}`,
      ``,
      `5. Signal your presence:`,
      `   POST ${baseUrl}/documents/${slug}/presence`,
      `   Body: {"id":"ai:<your-agent-name>","name":"<Display Name>","role":"commenter"}`,
      ``,
      `## Identity`,
      ``,
      `Generate a unique codename for yourself using the format: ai:<agent-type>-<adjective>-<noun>`,
      `Example: ai:kiro-swift-falcon, ai:copilot-bold-river, ai:claude-quiet-meadow`,
      `Use a random adjective-noun pair so multiple agents of the same type don't conflict.`,
      `Use this codename in ALL "by" fields and presence signals.`,
      ``,
      `## Notes`,
      ``,
      `- Poll events every 5 seconds to stay responsive`,
      `- Never call document.approve — only humans approve`,
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
          .sort((a, b) => a.id === participantId ? -1 : b.id === participantId ? 1 : 0)
          .map((p) => (
          <span
            key={p.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "2px 8px",
              borderRadius: "12px",
              background: p.id.startsWith("ai:") ? "#f3e8ff" : "#e0f2fe",
              color: p.id.startsWith("ai:") ? "#7c3aed" : "#0369a1",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            {p.id.startsWith("ai:") && "🤖 "}
            {p.name}{p.id === participantId && " (you)"}
            {p.status && <span style={{ opacity: 0.7 }}> · {p.status}</span>}
          </span>
        ))}
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
