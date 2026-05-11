interface Props {
  onApprove: () => void;
  onRequestChanges: () => void;
}

export function ApprovalBar({ onApprove, onRequestChanges }: Props) {
  return (
    <div
      style={{
        padding: "0.75rem 1.5rem",
        borderTop: "1px solid #e0e0e0",
        background: "#fff",
        display: "flex",
        justifyContent: "flex-end",
        gap: "0.75rem",
      }}
    >
      <button
        onClick={onRequestChanges}
        style={{
          padding: "8px 20px",
          borderRadius: "6px",
          border: "1px solid #e0e0e0",
          background: "#fff",
          color: "#dc2626",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Request Changes
      </button>
      <button
        onClick={onApprove}
        style={{
          padding: "8px 20px",
          borderRadius: "6px",
          border: "none",
          background: "#16a34a",
          color: "#fff",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Approve
      </button>
    </div>
  );
}
