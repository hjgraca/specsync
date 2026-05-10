import { Router, type Router as RouterType } from "express";
import { getDb, generateSlug, generateToken } from "../db.js";
import { requireAuth, requireOwner, type AuthenticatedRequest } from "../auth.js";
import type { CreateDocumentRequest, CreateDocumentResponse, DocumentState } from "../../shared/types.js";

const router: RouterType = Router();

const DEFAULT_TTL_DAYS = 30;

router.post("/documents", (req, res) => {
  const { title, markdown, files, callbackUrl, callbackSessionId, callbackId } = req.body as CreateDocumentRequest & { callbackUrl?: string; callbackSessionId?: string; callbackId?: string };

  if (!markdown && !files) {
    res.status(400).json({ error: "Either markdown or files is required", code: "MISSING_CONTENT" });
    return;
  }

  if (markdown && typeof markdown !== "string") {
    res.status(400).json({ error: "markdown must be a string", code: "VALIDATION_ERROR" });
    return;
  }

  if (title && typeof title !== "string") {
    res.status(400).json({ error: "title must be a string", code: "VALIDATION_ERROR" });
    return;
  }

  const content = markdown || "";
  const docTitle = title || "Untitled Review";
  const slug = generateSlug();
  const ownerSecret = generateToken();
  const accessToken = generateToken();

  const expiresAt = new Date(
    Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const db = getDb();

  db.prepare(
    `INSERT INTO documents (slug, title, markdown, owner_secret, callback_url, callback_session_id, callback_id, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(slug, docTitle, content, ownerSecret, callbackUrl || null, callbackSessionId || null, callbackId || null, expiresAt);

  db.prepare(
    `INSERT INTO document_tokens (token, slug, role) VALUES (?, ?, ?)`,
  ).run(accessToken, slug, "editor");

  db.prepare(
    `INSERT INTO document_revisions (slug, revision, markdown) VALUES (?, 1, ?)`,
  ).run(slug, content);

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const response: CreateDocumentResponse = {
    slug,
    docUrl: `${baseUrl}/review/${slug}?token=${accessToken}`,
    bridgeUrl: `${baseUrl}/documents/${slug}`,
    accessToken,
    ownerSecret,
  };

  res.status(201).json(response);
});

router.put(
  "/documents/:slug",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const { markdown, title } = req.body as { markdown: string; title?: string };

    if (!markdown) {
      res.status(400).json({ error: "markdown is required", code: "MISSING_CONTENT" });
      return;
    }

    const db = getDb();

    const current = db.prepare("SELECT revision FROM documents WHERE slug = ?").get(slug) as { revision: number } | undefined;
    if (!current) {
      res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
      return;
    }

    const newRevision = current.revision + 1;

    const updates = title
      ? "UPDATE documents SET markdown = ?, title = ?, revision = ?, status = 'active', updated_at = datetime('now') WHERE slug = ?"
      : "UPDATE documents SET markdown = ?, revision = ?, status = 'active', updated_at = datetime('now') WHERE slug = ?";

    if (title) {
      db.prepare(updates).run(markdown, title, newRevision, slug);
    } else {
      db.prepare(updates).run(markdown, newRevision, slug);
    }

    db.prepare(
      `INSERT INTO document_revisions (slug, revision, markdown) VALUES (?, ?, ?)`,
    ).run(slug, newRevision, markdown);

    db.prepare("INSERT INTO events (slug, type, data, actor) VALUES (?, ?, ?, ?)")
      .run(slug, "document.revised", JSON.stringify({ revision: newRevision }), "system");

    res.json({ success: true, slug, revision: newRevision, status: "active" });
  },
);

router.get(
  "/documents/:slug/state",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        "SELECT slug, title, markdown, marks, revision, status, created_at, updated_at FROM documents WHERE slug = ?",
      )
      .get(slug) as {
      slug: string;
      title: string;
      markdown: string;
      marks: string;
      revision: number;
      status: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) {
      res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
      return;
    }

    const state: DocumentState = {
      slug: row.slug,
      title: row.title,
      markdown: row.markdown,
      marks: JSON.parse(row.marks),
      revision: row.revision,
      status: row.status as DocumentState["status"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json(state);
  },
);

router.get(
  "/documents/:slug/revisions",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const db = getDb();
    const rows = db
      .prepare("SELECT revision, created_at FROM document_revisions WHERE slug = ? ORDER BY revision ASC")
      .all(slug) as Array<{ revision: number; created_at: string }>;

    res.json({ revisions: rows });
  },
);

router.get(
  "/documents/:slug/revisions/:rev",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug, rev } = req.params;
    const revNum = parseInt(rev as string, 10);

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const db = getDb();
    const row = db
      .prepare("SELECT revision, markdown, created_at FROM document_revisions WHERE slug = ? AND revision = ?")
      .get(slug, revNum) as { revision: number; markdown: string; created_at: string } | undefined;

    if (!row) {
      res.status(404).json({ error: "Revision not found", code: "NOT_FOUND" });
      return;
    }

    res.json(row);
  },
);

router.delete(
  "/documents/:slug",
  requireOwner,
  (req, res) => {
    const { slug } = req.params;
    const db = getDb();

    const result = db.prepare("DELETE FROM documents WHERE slug = ?").run(slug);

    if (result.changes === 0) {
      res.status(404).json({ error: "Document not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ deleted: true, slug });
  },
);

router.post(
  "/documents/:slug/join",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
      return;
    }

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
    ).run(sessionToken, slug, name.trim());

    res.status(201).json({ sessionToken, name: name.trim(), slug });
  },
);

router.get(
  "/documents/:slug/me",
  (req, res) => {
    const sessionToken = req.headers["x-session-token"] as string;

    if (!sessionToken) {
      res.status(401).json({ error: "No session", code: "NO_SESSION" });
      return;
    }

    const db = getDb();
    const row = db
      .prepare("SELECT name, slug, role FROM participant_sessions WHERE session_token = ?")
      .get(sessionToken) as { name: string; slug: string; role: string } | undefined;

    if (!row) {
      res.status(401).json({ error: "Invalid session", code: "INVALID_SESSION" });
      return;
    }

    res.json({ name: row.name, slug: row.slug, role: row.role });
  },
);

export default router;
