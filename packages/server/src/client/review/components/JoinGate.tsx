import { useState } from "react";

interface Props {
  initialName: string;
  /** When true, the name is fine and only the join code needs (re-)entering. */
  codeOnly?: boolean;
  error?: string | null;
  onJoin: (name: string, code: string) => void;
}

/**
 * Prompts a person for their name and the document's 6-character join code
 * before the document loads. The name is pre-filled from previous visits; if a
 * stored code fails validation we keep the name and ask only for a new code.
 */
export function JoinGate({ initialName, codeOnly, error, onJoin }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");

  const canSubmit = name.trim().length > 0 && code.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onJoin(name.trim(), code.trim().toLowerCase());
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fafafa" }}>
      <form
        onSubmit={submit}
        style={{
          width: "320px",
          padding: "2rem",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.25rem" }}>Join this review</h1>
        <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1.25rem" }}>
          {codeOnly
            ? "Enter the join code shared with you to continue."
            : "Enter your name and the join code shared with you."}
        </p>

        <label style={{ display: "block", fontSize: "0.75rem", color: "#555", marginBottom: "0.25rem" }}>
          Your name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          autoFocus={!codeOnly}
          placeholder="e.g. Alex Rivera"
          style={inputStyle}
        />

        <label style={{ display: "block", fontSize: "0.75rem", color: "#555", margin: "0.75rem 0 0.25rem" }}>
          Join code
        </label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          autoFocus={codeOnly}
          placeholder="6-character code"
          style={{ ...inputStyle, letterSpacing: "0.2em", fontFamily: "monospace" }}
        />

        {error && (
          <p style={{ color: "#e63946", fontSize: "0.75rem", marginTop: "0.75rem" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%",
            marginTop: "1.25rem",
            padding: "0.6rem",
            borderRadius: "6px",
            border: "none",
            background: canSubmit ? "#3b82f6" : "#cbd5e1",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          Join
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: "6px",
  border: "1px solid #d1d5db",
  fontSize: "0.85rem",
  boxSizing: "border-box",
};
