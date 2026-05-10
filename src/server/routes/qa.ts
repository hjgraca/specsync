import { Router, type Router as RouterType } from "express";
import { randomUUID } from "crypto";
import { getDb, generateToken } from "../db.js";
import type { StructuredQuestion, QASession } from "../../shared/types.js";

const router: RouterType = Router();

const DEFAULT_TTL_DAYS = 1;

router.post("/qa/sessions", (req, res) => {
  const { title, questions, callbackUrl, callbackSessionId, callbackId } = req.body as {
    title?: string;
    questions: StructuredQuestion[];
    callbackUrl?: string;
    callbackSessionId?: string;
    callbackId?: string;
  };

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "questions array is required", code: "MISSING_QUESTIONS" });
    return;
  }

  for (const q of questions) {
    if (!q || typeof q !== "object" || !q.id || !q.title) {
      res.status(400).json({ error: "Each question must have id and title", code: "VALIDATION_ERROR" });
      return;
    }
  }

  const id = randomUUID();
  const token = generateToken();
  const sessionTitle = title || "Agent Questions";
  const expiresAt = new Date(
    Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const db = getDb();
  db.prepare(
    `INSERT INTO qa_sessions (id, title, questions, token, callback_url, callback_session_id, callback_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionTitle, JSON.stringify(questions), token, callbackUrl || null, callbackSessionId || null, callbackId || null, expiresAt);

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.status(201).json({
    id,
    token,
    url: `${baseUrl}/qa/${id}?token=${token}`,
    title: sessionTitle,
    questions,
    answers: {},
    discussions: {},
    status: "active",
    createdAt: new Date().toISOString(),
  });
});

function validateQAToken(req: any, res: any): boolean {
  const { id } = req.params;
  const token = req.query.token || req.headers["x-share-token"];
  if (!token) {
    res.status(401).json({ error: "Token required", code: "NO_TOKEN" });
    return false;
  }
  const db = getDb();
  const row = db.prepare("SELECT token FROM qa_sessions WHERE id = ?").get(id) as { token: string } | undefined;
  if (!row || row.token !== token) {
    res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" });
    return false;
  }
  return true;
}

router.get("/qa/sessions/:id", (req, res) => {
  if (!validateQAToken(req, res)) return;
  const { id } = req.params;
  const db = getDb();

  const row = db
    .prepare("SELECT id, title, questions, answers, discussions, status, created_at FROM qa_sessions WHERE id = ?")
    .get(id) as {
    id: string;
    title: string;
    questions: string;
    answers: string;
    discussions: string;
    status: string;
    created_at: string;
  } | undefined;

  if (!row) {
    res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
    return;
  }

  const session: QASession = {
    id: row.id,
    title: row.title,
    questions: JSON.parse(row.questions),
    answers: JSON.parse(row.answers),
    discussions: JSON.parse(row.discussions),
    status: row.status as QASession["status"],
    createdAt: row.created_at,
  };

  res.json(session);
});

router.post("/qa/sessions/:id/questions", (req, res) => {
  if (!validateQAToken(req, res)) return;
  const { id } = req.params;
  const { questions: newQuestions } = req.body as { questions: StructuredQuestion[] };

  if (!newQuestions || !Array.isArray(newQuestions) || newQuestions.length === 0) {
    res.status(400).json({ error: "questions array is required", code: "MISSING_QUESTIONS" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare("SELECT questions, answers FROM qa_sessions WHERE id = ?")
    .get(id) as { questions: string; answers: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
    return;
  }

  const existing: StructuredQuestion[] = JSON.parse(row.questions);
  const combined = [...existing, ...newQuestions];

  db.prepare("UPDATE qa_sessions SET questions = ?, status = 'active' WHERE id = ?")
    .run(JSON.stringify(combined), id);

  res.json({ success: true, totalQuestions: combined.length });
});

router.post("/qa/sessions/:id/answer", (req, res) => {
  if (!validateQAToken(req, res)) return;
  const { id } = req.params;
  const { questionId, answer } = req.body as { questionId: string; answer: string };

  if (!questionId || answer === undefined) {
    res.status(400).json({ error: "questionId and answer are required", code: "MISSING_FIELDS" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare("SELECT questions, answers FROM qa_sessions WHERE id = ? AND status = 'active'")
    .get(id) as { questions: string; answers: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Active session not found", code: "NOT_FOUND" });
    return;
  }

  const questions: StructuredQuestion[] = JSON.parse(row.questions);
  const answers: Record<string, string> = JSON.parse(row.answers);

  const question = questions.find((q) => q.id === questionId);
  if (!question) {
    res.status(400).json({ error: `Question ${questionId} not found in session`, code: "INVALID_QUESTION" });
    return;
  }

  answers[questionId] = answer;

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const newStatus = allAnswered ? "completed" : "active";

  db.prepare("UPDATE qa_sessions SET answers = ?, status = ? WHERE id = ?")
    .run(JSON.stringify(answers), newStatus, id);

  if (allAnswered) {
    const cbRow = db.prepare("SELECT callback_url, callback_session_id, callback_id FROM qa_sessions WHERE id = ?")
      .get(id) as { callback_url: string | null; callback_session_id: string | null; callback_id: string | null } | undefined;

    if (cbRow?.callback_url && cbRow.callback_session_id && cbRow.callback_id) {
      fetch(cbRow.callback_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: cbRow.callback_session_id,
          callbackId: cbRow.callback_id,
          responseContent: JSON.stringify(answers),
          surface: "specsync",
        }),
      }).catch(() => {});
    }
  }

  res.json({ success: true, questionId, answer, allAnswered, status: newStatus });
});

router.post("/qa/sessions/:id/discuss", (req, res) => {
  if (!validateQAToken(req, res)) return;
  const { id } = req.params;
  const { questionId, by, text } = req.body as { questionId: string; by: string; text: string };

  if (!questionId || !by || !text) {
    res.status(400).json({ error: "questionId, by, and text are required", code: "MISSING_FIELDS" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare("SELECT discussions FROM qa_sessions WHERE id = ?")
    .get(id) as { discussions: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
    return;
  }

  const discussions: Record<string, Array<{ by: string; text: string; createdAt: string }>> =
    JSON.parse(row.discussions);

  if (!discussions[questionId]) {
    discussions[questionId] = [];
  }

  const message = { by, text, createdAt: new Date().toISOString() };
  discussions[questionId].push(message);

  db.prepare("UPDATE qa_sessions SET discussions = ? WHERE id = ?")
    .run(JSON.stringify(discussions), id);

  res.json({ success: true, message });
});

router.post("/qa/sessions/:id/join", (req, res) => {
  if (!validateQAToken(req, res)) return;
  const { id } = req.params;
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required", code: "MISSING_FIELDS" });
    return;
  }

  if (name.length > 50) {
    res.status(400).json({ error: "name exceeds maximum length of 50", code: "VALIDATION_ERROR" });
    return;
  }

  const db = getDb();
  const sessionToken = generateToken();

  db.prepare(
    `INSERT INTO participant_sessions (session_token, slug, name) VALUES (?, ?, ?)`,
  ).run(sessionToken, id, name.trim());

  res.status(201).json({ sessionToken, name: name.trim() });
});

export default router;
