import { useState, useEffect } from "react";
import type { QASession, StructuredQuestion } from "../../shared/types.js";
import { QuestionForm } from "./components/QuestionForm.js";
import { PresenceBar } from "./components/PresenceBar.js";
import { QRButton } from "../shared/QRButton.js";
import { useParticipant } from "../shared/useParticipant.js";

export function App() {
  const [session, setSession] = useState<QASession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = window.location.pathname.split("/qa/")[1];
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const { participant, setName } = useParticipant();
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID in URL");
      return;
    }

    const fetchSession = async () => {
      try {
        const res = await fetch(`/qa/sessions/${sessionId}?token=${token}`);
        if (!res.ok) {
          setError("Session not found or expired");
          return;
        }
        const data = await res.json();
        setSession(data);
      } catch {
        setError("Failed to connect to server");
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleAnswer = async (questionId: string, answer: string) => {
    const res = await fetch(`/qa/sessions/${sessionId}/answer?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answer }),
    });

    if (res.ok) {
      const updated = await fetch(`/qa/sessions/${sessionId}?token=${token}`);
      if (updated.ok) {
        setSession(await updated.json());
      }
    }
  };

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1 style={{ color: "#e63946" }}>{error}</h1>
      </div>
    );
  }

  if (!participant.name) {
    return (
      <div style={{ maxWidth: "360px", margin: "4rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>What's your name?</h1>
        <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Shown to the team alongside your answers.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) setName(nameDraft); }}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={50}
            autoFocus
            placeholder="e.g. Alex Rivera"
            style={{ flex: 1, padding: "0.5rem 0.6rem", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
          />
          <button
            type="submit"
            disabled={!nameDraft.trim()}
            style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", background: nameDraft.trim() ? "#3b82f6" : "#cbd5e1", color: "#fff", fontSize: "0.85rem", cursor: nameDraft.trim() ? "pointer" : "not-allowed" }}
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (session.status === "completed") {
    return (
      <div style={{ maxWidth: "720px", margin: "2rem auto", padding: "0 1rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>{session.title}</h1>
        <p style={{ color: "#2d6a4f", fontWeight: 600, marginBottom: "2rem" }}>
          All questions answered. The agent is continuing.
        </p>
        {session.questions.map((q) => {
          const answer = session.answers[q.id];
          const opt = q.options?.find((o) => o.key === answer);
          const displayAnswer = opt ? `${opt.label} (${answer})` : answer;
          return (
            <div key={q.id} style={{ marginBottom: "1.5rem", padding: "1rem", background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
              <h3>{q.title}</h3>
              <p style={{ color: "#555", marginTop: "0.5rem" }}>
                Answer: <strong>{displayAnswer}</strong>
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <PresenceBar sessionId={sessionId} token={token} participantId={participant.id} participantName={participant.name} />
        <QRButton />
      </div>
      <h1 style={{ marginBottom: "0.5rem" }}>{session.title}</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Answer the questions below. The agent is waiting for your responses.
      </p>
      {session.questions.map((q: StructuredQuestion) => (
        <QuestionForm
          key={q.id}
          question={q}
          currentAnswer={session.answers[q.id]}
          onSubmit={(answer) => handleAnswer(q.id, answer)}
        />
      ))}
    </div>
  );
}
