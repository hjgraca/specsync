import { useState, useEffect } from "react";

interface PresenceEntry {
  id: string;
  name: string;
}

interface Props {
  sessionId: string;
  token: string;
  participantId: string;
  participantName: string;
}

export function PresenceBar({ sessionId, token, participantId, participantName }: Props) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    fetch(`/qa/sessions/${sessionId}/presence?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: participantId, name: participantName, role: "viewer" }),
    }).catch(() => {});

    const poll = () => {
      fetch(`/qa/sessions/${sessionId}/presence?token=${token}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setPresence(d.presence || []); })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [sessionId, token, participantId, participantName]);

  if (presence.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "1rem",
        padding: "0.5rem 1rem",
        background: "#fff",
        borderRadius: "6px",
        border: "1px solid #e0e0e0",
        fontSize: "0.85rem",
        color: "#555",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#22c55e",
          display: "inline-block",
        }}
      />
      <span>{
        [...presence]
          .sort((a, b) => a.id === participantId ? -1 : b.id === participantId ? 1 : 0)
          .map(p => p.id === participantId ? `${p.name} (you)` : p.name)
          .join(", ")
      }</span>
    </div>
  );
}
