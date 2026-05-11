import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import path from "path";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath =
      process.env.REVIEW_TOOL_DB_PATH ||
      path.join(process.cwd(), "specsync.db");
    db = Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      marks TEXT NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      owner_secret TEXT NOT NULL,
      callback_url TEXT,
      callback_session_id TEXT,
      callback_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_tokens (
      token TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'commenter',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (slug) REFERENCES documents(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (slug) REFERENCES documents(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_acks (
      slug TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      last_event_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (slug, agent_id)
    );

    CREATE TABLE IF NOT EXISTS qa_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT '',
      questions TEXT NOT NULL DEFAULT '[]',
      answers TEXT NOT NULL DEFAULT '{}',
      discussions TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      callback_url TEXT,
      callback_session_id TEXT,
      callback_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_revisions (
      slug TEXT NOT NULL,
      revision INTEGER NOT NULL,
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (slug, revision),
      FOREIGN KEY (slug) REFERENCES documents(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS participant_sessions (
      session_token TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'commenter',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug, id);
    CREATE INDEX IF NOT EXISTS idx_documents_expires ON documents(expires_at);
    CREATE INDEX IF NOT EXISTS idx_qa_sessions_expires ON qa_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_revisions_slug ON document_revisions(slug, revision);
  `);
}

export function generateSlug(): string {
  return randomBytes(8).toString("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function purgeExpired(): number {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM documents WHERE expires_at < datetime('now')")
    .run();
  const qaResult = db
    .prepare("DELETE FROM qa_sessions WHERE expires_at < datetime('now')")
    .run();
  return result.changes + qaResult.changes;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
