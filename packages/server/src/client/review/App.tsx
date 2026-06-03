import { useState, useEffect } from "react";
import type { DocumentState, Mark } from "../../shared/types.js";
import { MarkdownViewer } from "./components/MarkdownViewer.js";
import { CommentSidebar } from "./components/CommentSidebar.js";
import { ApprovalBar } from "./components/ApprovalBar.js";
import { RevisionBanner } from "./components/RevisionBanner.js";
import { RevisionPanel } from "./components/RevisionPanel.js";
import { PresenceBar } from "./components/PresenceBar.js";
import { JoinGate } from "./components/JoinGate.js";
import { QRButton } from "../shared/QRButton.js";
import { useParticipant } from "../shared/useParticipant.js";
import { authHeaders, loadJoinCode, saveJoinCode } from "../shared/auth.js";

export function App() {
  const [doc, setDoc] = useState<DocumentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);

  const role = new URLSearchParams(window.location.search).get("role") || "editor";

  const pathParts = window.location.pathname.split("/review/");
  const slug = pathParts[1];
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const { participant, setName } = useParticipant();

  // The join code is the required second factor. Start from storage; if it's
  // missing or rejected we fall back to the JoinGate prompt below.
  const [code, setCode] = useState<string>(() => loadJoinCode(slug));
  const [joined, setJoined] = useState<boolean>(() => !!participant.name && !!loadJoinCode(slug));
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !token) {
      setError("Missing document slug or token in URL");
      return;
    }
    if (!joined) return;

    const fetchState = async () => {
      try {
        const res = await fetch(`/documents/${slug}/state`, {
          headers: authHeaders(token, code),
        });
        if (res.status === 403) {
          // Stored code no longer valid (e.g. a different document) — re-prompt
          // for the code but keep the name.
          setJoinError("That join code didn't work. Check the code and try again.");
          setJoined(false);
          return;
        }
        if (!res.ok) {
          setError("Document not found or invalid token");
          return;
        }
        setDoc(await res.json());
      } catch {
        setError("Failed to connect to server");
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [slug, token, joined, code]);

  const handleJoin = (name: string, enteredCode: string) => {
    setName(name);
    saveJoinCode(slug, enteredCode);
    setCode(enteredCode);
    setJoinError(null);
    setJoined(true);
  };

  const refreshState = async () => {
    const res = await fetch(`/documents/${slug}/state`, { headers: authHeaders(token, code) });
    if (res.ok) setDoc(await res.json());
  };

  const handleAddComment = async (ctx: { quote: string; contextBefore: string; contextAfter: string }, text: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "comment.add", by: `human:${participant.name}`, quote: ctx.quote, contextBefore: ctx.contextBefore, contextAfter: ctx.contextAfter, text }),
    });
    await refreshState();
  };

  const handleAddSuggestion = async (ctx: { quote: string; contextBefore: string; contextAfter: string }, content: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "suggestion.add", by: `human:${participant.name}`, quote: ctx.quote, contextBefore: ctx.contextBefore, contextAfter: ctx.contextAfter, content, kind: "replace" }),
    });
    await refreshState();
  };

  const handleReply = async (markId: string, text: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "comment.reply", markId, by: `human:${participant.name}`, text }),
    });
    await refreshState();
  };

  const handleResolve = async (markId: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "comment.resolve", markId, by: `human:${participant.name}` }),
    });
    await refreshState();
  };

  const handleGlobalComment = async (text: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "comment.add", by: `human:${participant.name}`, quote: "[general]", text }),
    });
    await refreshState();
  };

  const handleAcceptSuggestion = async (markId: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "suggestion.accept", markId, by: `human:${participant.name}` }),
    });
    await refreshState();
  };

  const handleRejectSuggestion = async (markId: string) => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "suggestion.reject", markId, by: `human:${participant.name}` }),
    });
    await refreshState();
  };

  const handleApprove = async () => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "document.approve", by: `human:${participant.name}` }),
    });
    await refreshState();
  };

  const handleRequestChanges = async () => {
    await fetch(`/documents/${slug}/ops`, {
      method: "POST",
      headers: authHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type: "document.request_changes", by: `human:${participant.name}` }),
    });
    await refreshState();
  };

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1 style={{ color: "#e63946" }}>{error}</h1>
      </div>
    );
  }

  if (!joined) {
    return (
      <JoinGate
        initialName={participant.name}
        codeOnly={!!participant.name}
        error={joinError}
        onJoin={handleJoin}
      />
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading document...</p>
      </div>
    );
  }

  const marks = Object.values(doc.marks) as Mark[];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{doc.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", position: "relative" }}>
          <QRButton />
          <button
            onClick={() => setShowRevisionPanel(true)}
            style={{ padding: "3px 8px", borderRadius: "4px", border: "1px solid #e0e0e0", background: "#fff", fontSize: "0.75rem", cursor: "pointer", color: "#555" }}
          >
            History
          </button>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            Rev {doc.revision} · {doc.status}
          </span>
        </div>
      </header>

      <PresenceBar slug={slug} token={token} code={code} participantId={participant.id} participantName={participant.name} />
      <RevisionBanner revision={doc.revision} onViewChanges={() => setShowRevisionPanel(true)} />
      <RevisionPanel
        slug={slug}
        token={token}
        code={code}
        currentRevision={doc.revision}
        show={showRevisionPanel}
        onClose={() => setShowRevisionPanel(false)}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <main style={{ flex: 1, overflow: "auto", padding: "2rem" }}>
          <MarkdownViewer
            markdown={doc.markdown}
            marks={marks}
            onTextSelect={setSelectedText}
            onComment={handleAddComment}
            onSuggest={handleAddSuggestion}
            selectedText={selectedText}
            activeMarkId={activeMarkId}
            onHighlightClick={(markId) => {
              setActiveMarkId(markId);
              document.querySelector(`[data-comment-id="${markId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </main>

        <aside style={{ width: "360px", borderLeft: "1px solid #e0e0e0", overflow: "auto", background: "#fff" }}>
          <CommentSidebar
            marks={marks}
            markdown={doc.markdown}
            currentRevision={doc.revision}
            activeMarkId={activeMarkId}
            role={role}
            onReply={handleReply}
            onResolve={handleResolve}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onGlobalComment={handleGlobalComment}
            onCommentClick={(markId) => {
              setActiveMarkId(markId);
              const highlight = document.querySelector(`mark[data-mark-id="${markId}"]`);
              if (highlight) {
                highlight.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        </aside>
      </div>

      {doc.status === "active" && (role === "editor" || role === "owner") && (
        <ApprovalBar
          onApprove={handleApprove}
          onRequestChanges={handleRequestChanges}
        />
      )}
    </div>
  );
}
