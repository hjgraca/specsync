import { useState } from "react";

interface Props {
  revision: number;
  onViewChanges: () => void;
}

export function RevisionBanner({ revision, onViewChanges }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (revision <= 1 || dismissed) return null;

  return (
    <div
      style={{
        padding: "0.6rem 1.5rem",
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "0.85rem",
      }}
    >
      <span>
        <strong>Revision {revision}</strong> — Agent updated the spec.{" "}
        <button
          onClick={onViewChanges}
          style={{
            background: "none",
            border: "none",
            color: "#2563eb",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          View changes
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1rem" }}
      >
        ×
      </button>
    </div>
  );
}
