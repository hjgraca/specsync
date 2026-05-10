import { Router, type Router as RouterType } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db.js";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";
import type { Mark, ThreadEntry, EventType } from "../../shared/types.js";

const MAX_QUOTE_LENGTH = 500;
const MAX_TEXT_LENGTH = 5000;
const MAX_BY_LENGTH = 100;

function validateStringField(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== "string") return `${name} must be a string`;
  if (value.length > maxLength) return `${name} exceeds maximum length of ${maxLength}`;
  return null;
}

const router: RouterType = Router();

router.post(
  "/documents/:slug/ops",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const { type, ...payload } = req.body;

    if (!type) {
      res.status(400).json({ error: "Operation type is required", code: "MISSING_TYPE" });
      return;
    }

    const handlers: Record<string, () => void> = {
      "comment.add": () => handleCommentAdd(slug, payload, req, res),
      "comment.reply": () => handleCommentReply(slug, payload, req, res),
      "suggestion.add": () => handleSuggestionAdd(slug, payload, req, res),
      "suggestion.accept": () => handleSuggestionAccept(slug, payload, req, res),
      "suggestion.reject": () => handleSuggestionReject(slug, payload, req, res),
      "comment.resolve": () => handleCommentResolve(slug, payload, req, res),
      "document.approve": () => handleApprove(slug, payload, req, res),
      "document.request_changes": () => handleRequestChanges(slug, payload, req, res),
    };

    const handler = handlers[type];
    if (!handler) {
      res.status(400).json({ error: `Unknown operation type: ${type}`, code: "UNKNOWN_TYPE" });
      return;
    }

    handler();
  },
);

function handleCommentAdd(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { by, quote, text, contextBefore, contextAfter } = payload as {
    by: string; quote: string; text: string; contextBefore?: string; contextAfter?: string;
  };

  if (!by || !quote || !text) {
    res.status(400).json({ error: "by, quote, and text are required", code: "MISSING_FIELDS" });
    return;
  }

  const byErr = validateStringField(by, "by", MAX_BY_LENGTH);
  const quoteErr = validateStringField(quote, "quote", MAX_QUOTE_LENGTH);
  const textErr = validateStringField(text, "text", MAX_TEXT_LENGTH);
  const fieldErr = byErr || quoteErr || textErr;
  if (fieldErr) {
    res.status(400).json({ error: fieldErr, code: "VALIDATION_ERROR" });
    return;
  }

  const markId = randomUUID();
  const mark: Mark = {
    id: markId,
    type: "comment",
    by,
    quote,
    contextBefore,
    contextAfter,
    text,
    thread: [],
    resolved: false,
    revision: getDocRevision(slug),
    createdAt: new Date().toISOString(),
  };

  addMark(slug, markId, mark);
  emitEvent(slug, "comment.added", { markId, by, quote, text }, by);

  res.status(201).json({ success: true, mark });
}

function handleCommentReply(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { markId, by, text } = payload as { markId: string; by: string; text: string };

  if (!markId || !by || !text) {
    res.status(400).json({ error: "markId, by, and text are required", code: "MISSING_FIELDS" });
    return;
  }

  const byErr = validateStringField(by, "by", MAX_BY_LENGTH);
  const textErr = validateStringField(text, "text", MAX_TEXT_LENGTH);
  const fieldErr = byErr || textErr;
  if (fieldErr) {
    res.status(400).json({ error: fieldErr, code: "VALIDATION_ERROR" });
    return;
  }

  const db = getDb();
  const row = db.prepare("SELECT marks FROM documents WHERE slug = ?").get(slug) as { marks: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
    return;
  }

  const marks: Record<string, Mark> = JSON.parse(row.marks);
  const mark = marks[markId];

  if (!mark) {
    res.status(404).json({ error: "Mark not found", code: "MARK_NOT_FOUND" });
    return;
  }

  const entry: ThreadEntry = { by, text, createdAt: new Date().toISOString() };
  mark.thread.push(entry);

  db.prepare("UPDATE documents SET marks = ?, updated_at = datetime('now') WHERE slug = ?")
    .run(JSON.stringify(marks), slug);

  emitEvent(slug, "comment.replied", { markId, by, text }, by);

  res.json({ success: true, entry });
}

function handleSuggestionAdd(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { by, quote, content, kind, contextBefore, contextAfter } = payload as {
    by: string;
    quote: string;
    content: string;
    kind?: string;
    contextBefore?: string;
    contextAfter?: string;
  };

  if (!by || !quote || !content) {
    res.status(400).json({ error: "by, quote, and content are required", code: "MISSING_FIELDS" });
    return;
  }

  const byErr = validateStringField(by, "by", MAX_BY_LENGTH);
  const quoteErr = validateStringField(quote, "quote", MAX_QUOTE_LENGTH);
  const contentErr = validateStringField(content, "content", MAX_TEXT_LENGTH);
  const fieldErr = byErr || quoteErr || contentErr;
  if (fieldErr) {
    res.status(400).json({ error: fieldErr, code: "VALIDATION_ERROR" });
    return;
  }

  const markId = randomUUID();
  const mark: Mark = {
    id: markId,
    type: "suggestion",
    by,
    quote,
    contextBefore,
    contextAfter,
    content,
    kind: (kind as Mark["kind"]) || "replace",
    thread: [],
    resolved: false,
    revision: getDocRevision(slug),
    createdAt: new Date().toISOString(),
  };

  addMark(slug, markId, mark);
  emitEvent(slug, "suggestion.added", { markId, by, quote, content, kind }, by);

  res.status(201).json({ success: true, mark });
}

function handleSuggestionAccept(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { markId, by } = payload as { markId: string; by: string };

  if (!markId) {
    res.status(400).json({ error: "markId is required", code: "MISSING_FIELDS" });
    return;
  }

  const db = getDb();
  const row = db.prepare("SELECT marks, markdown FROM documents WHERE slug = ?").get(slug) as { marks: string; markdown: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
    return;
  }

  const marks: Record<string, Mark> = JSON.parse(row.marks);
  const mark = marks[markId];

  if (!mark) {
    res.status(404).json({ error: "Mark not found", code: "MARK_NOT_FOUND" });
    return;
  }

  if (mark.type !== "suggestion") {
    res.status(400).json({ error: "Mark is not a suggestion", code: "NOT_SUGGESTION" });
    return;
  }

  const newMarkdown = row.markdown.replace(mark.quote, mark.content || "");
  mark.resolved = true;

  db.prepare("UPDATE documents SET marks = ?, markdown = ?, updated_at = datetime('now') WHERE slug = ?")
    .run(JSON.stringify(marks), newMarkdown, slug);

  emitEvent(slug, "suggestion.accepted", { markId, by }, by || "unknown");

  res.json({ success: true, markId, accepted: true });
}

function handleSuggestionReject(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { markId, by } = payload as { markId: string; by: string };

  if (!markId) {
    res.status(400).json({ error: "markId is required", code: "MISSING_FIELDS" });
    return;
  }

  const db = getDb();
  const row = db.prepare("SELECT marks FROM documents WHERE slug = ?").get(slug) as { marks: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
    return;
  }

  const marks: Record<string, Mark> = JSON.parse(row.marks);
  const mark = marks[markId];

  if (!mark) {
    res.status(404).json({ error: "Mark not found", code: "MARK_NOT_FOUND" });
    return;
  }

  mark.resolved = true;

  db.prepare("UPDATE documents SET marks = ?, updated_at = datetime('now') WHERE slug = ?")
    .run(JSON.stringify(marks), slug);

  emitEvent(slug, "suggestion.rejected", { markId, by }, by || "unknown");

  res.json({ success: true, markId, rejected: true });
}

function handleCommentResolve(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { markId, by } = payload as { markId: string; by: string };

  if (!markId) {
    res.status(400).json({ error: "markId is required", code: "MISSING_FIELDS" });
    return;
  }

  const db = getDb();
  const row = db.prepare("SELECT marks FROM documents WHERE slug = ?").get(slug) as { marks: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
    return;
  }

  const marks: Record<string, Mark> = JSON.parse(row.marks);
  const mark = marks[markId];

  if (!mark) {
    res.status(404).json({ error: "Mark not found", code: "MARK_NOT_FOUND" });
    return;
  }

  mark.resolved = true;

  db.prepare("UPDATE documents SET marks = ?, updated_at = datetime('now') WHERE slug = ?")
    .run(JSON.stringify(marks), slug);

  emitEvent(slug, "comment.resolved", { markId, by }, by || "unknown");

  res.json({ success: true, markId, resolved: true });
}

function fireCallback(slug: string, responseContent: string): void {
  const db = getDb();
  const row = db.prepare("SELECT callback_url, callback_session_id, callback_id FROM documents WHERE slug = ?")
    .get(slug) as { callback_url: string | null; callback_session_id: string | null; callback_id: string | null } | undefined;

  if (!row?.callback_url || !row.callback_session_id || !row.callback_id) return;

  fetch(row.callback_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: row.callback_session_id,
      callbackId: row.callback_id,
      responseContent,
      surface: "specsync",
    }),
  }).catch(() => {});
}

function handleApprove(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { by } = payload as { by: string };

  const db = getDb();
  db.prepare("UPDATE documents SET status = 'approved', updated_at = datetime('now') WHERE slug = ?")
    .run(slug);

  emitEvent(slug, "document.approved", { by }, by || "unknown");
  fireCallback(slug, "approved");

  res.json({ success: true, status: "approved", approvedBy: by });
}

function handleRequestChanges(
  slug: string,
  payload: Record<string, unknown>,
  _req: AuthenticatedRequest,
  res: any,
): void {
  const { by, comments } = payload as { by: string; comments?: unknown[] };

  const db = getDb();
  db.prepare("UPDATE documents SET status = 'changes_requested', updated_at = datetime('now') WHERE slug = ?")
    .run(slug);

  emitEvent(slug, "document.changes_requested", { by, comments }, by || "unknown");
  fireCallback(slug, "rejected");

  res.json({ success: true, status: "changes_requested" });
}

function getDocRevision(slug: string): number {
  const db = getDb();
  const row = db.prepare("SELECT revision FROM documents WHERE slug = ?").get(slug) as { revision: number };
  return row.revision;
}

function addMark(slug: string, markId: string, mark: Mark): void {
  const db = getDb();
  const row = db.prepare("SELECT marks FROM documents WHERE slug = ?").get(slug) as { marks: string };
  const marks: Record<string, Mark> = JSON.parse(row.marks);
  marks[markId] = mark;

  db.prepare("UPDATE documents SET marks = ?, updated_at = datetime('now') WHERE slug = ?")
    .run(JSON.stringify(marks), slug);
}

function emitEvent(slug: string, type: EventType, data: Record<string, unknown>, actor: string): void {
  const db = getDb();
  db.prepare("INSERT INTO events (slug, type, data, actor) VALUES (?, ?, ?, ?)")
    .run(slug, type, JSON.stringify(data), actor);
}

export default router;
