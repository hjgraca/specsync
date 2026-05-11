import { useState, useEffect } from "react";

interface Revision {
  revision: number;
  created_at: string;
}

interface Props {
  slug: string;
  token: string;
  currentRevision: number;
  show: boolean;
  onClose: () => void;
}

export function RevisionPanel({ slug, token, currentRevision, show, onClose }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedRev, setSelectedRev] = useState<number | null>(null);
  const [revContent, setRevContent] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<{ prev: string; current: string } | null>(null);
  const [viewMode, setViewMode] = useState<"content" | "diff">("content");

  useEffect(() => {
    if (!show) return;
    fetch(`/documents/${slug}/revisions`, { headers: { "x-share-token": token } })
      .then((r) => r.json())
      .then((d) => setRevisions(d.revisions || []))
      .catch(() => {});
  }, [show, slug, token, currentRevision]);

  const viewRevision = async (rev: number) => {
    setSelectedRev(rev);

    try {
      const curr = await fetch(`/documents/${slug}/revisions/${rev}`, { headers: { "x-share-token": token } }).then((r) => r.json());
      setRevContent(curr.markdown);

      const revIndex = revisions.findIndex((r) => r.revision === rev);
      if (revIndex > 0) {
        const prevRevNum = revisions[revIndex - 1].revision;
        const prev = await fetch(`/documents/${slug}/revisions/${prevRevNum}`, { headers: { "x-share-token": token } }).then((r) => r.json());
        setDiffContent({ prev: prev.markdown, current: curr.markdown });
        setViewMode("diff");
      } else {
        setDiffContent(null);
        setViewMode("content");
      }
    } catch {
      setRevContent(null);
      setDiffContent(null);
    }
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "500px",
        height: "100vh",
        background: "#fff",
        borderLeft: "1px solid #e0e0e0",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: "1rem", margin: 0 }}>Revision History</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
      </div>

      <div style={{ padding: "1rem", borderBottom: "1px solid #f0f0f0" }}>
        {revisions.map((r) => (
          <button
            key={r.revision}
            onClick={() => viewRevision(r.revision)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.5rem 0.75rem",
              marginBottom: "0.25rem",
              borderRadius: "4px",
              border: selectedRev === r.revision ? "1px solid #3b82f6" : "1px solid transparent",
              background: selectedRev === r.revision ? "#eff6ff" : "transparent",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            <strong>Rev {r.revision}</strong>
            {r.revision === currentRevision && <span style={{ color: "#16a34a", marginLeft: "0.5rem" }}>(current)</span>}
            <span style={{ color: "#999", marginLeft: "0.5rem", fontSize: "0.75rem" }}>
              {new Date(r.created_at).toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {selectedRev && (
        <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #f0f0f0", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setViewMode("content")}
            style={{ padding: "3px 8px", borderRadius: "4px", border: "1px solid #e0e0e0", background: viewMode === "content" ? "#3b82f6" : "#fff", color: viewMode === "content" ? "#fff" : "#555", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Content
          </button>
          {diffContent && (
            <button
              onClick={() => setViewMode("diff")}
              style={{ padding: "3px 8px", borderRadius: "4px", border: "1px solid #e0e0e0", background: viewMode === "diff" ? "#3b82f6" : "#fff", color: viewMode === "diff" ? "#fff" : "#555", fontSize: "0.75rem", cursor: "pointer" }}
            >
              Diff
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        {!selectedRev && (
          <p style={{ color: "#999", fontSize: "0.9rem", textAlign: "center", marginTop: "2rem" }}>Select a revision to view</p>
        )}

        {selectedRev && viewMode === "content" && revContent && (
          <pre style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", lineHeight: 1.5 }}>
            {revContent}
          </pre>
        )}

        {selectedRev && viewMode === "diff" && diffContent && (
          <div style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
            <p style={{ marginBottom: "0.75rem", color: "#555", fontSize: "0.85rem", fontFamily: "sans-serif" }}>
              Changes to reach Rev {selectedRev}:
            </p>
            {computeLineDiff(diffContent.prev, diffContent.current).map((line, i) => (
              <div
                key={i}
                style={{
                  padding: "1px 8px",
                  background: line.type === "add" ? "#dcfce7" : line.type === "remove" ? "#fee2e2" : "transparent",
                  color: line.type === "add" ? "#166534" : line.type === "remove" ? "#991b1b" : "#333",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DiffLine {
  type: "add" | "remove" | "same";
  text: string;
}

function computeLineDiff(prev: string, current: string): DiffLine[] {
  const prevLines = prev.split("\n");
  const currLines = current.split("\n");
  const result: DiffLine[] = [];

  let pi = 0;
  let ci = 0;

  while (pi < prevLines.length || ci < currLines.length) {
    if (pi >= prevLines.length) {
      result.push({ type: "add", text: currLines[ci] });
      ci++;
    } else if (ci >= currLines.length) {
      result.push({ type: "remove", text: prevLines[pi] });
      pi++;
    } else if (prevLines[pi] === currLines[ci]) {
      result.push({ type: "same", text: currLines[ci] });
      pi++;
      ci++;
    } else {
      result.push({ type: "remove", text: prevLines[pi] });
      pi++;
      if (ci < currLines.length && (pi >= prevLines.length || prevLines[pi] !== currLines[ci])) {
        result.push({ type: "add", text: currLines[ci] });
        ci++;
      }
    }
  }

  return result;
}
