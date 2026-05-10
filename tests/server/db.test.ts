import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { generateSlug, generateToken } from "../../src/server/db.js";

describe("db utilities", () => {
  describe("generateSlug", () => {
    it("returns an 8-character hex string", () => {
      const slug = generateSlug();
      expect(slug).toHaveLength(8);
      expect(slug).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique slugs", () => {
      const slugs = new Set(Array.from({ length: 100 }, () => generateSlug()));
      expect(slugs.size).toBe(100);
    });
  });

  describe("generateToken", () => {
    it("returns a base64url string of 43 characters", () => {
      const token = generateToken();
      expect(token).toHaveLength(43);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("generates unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe("schema initialization", () => {
    let db: Database.Database;

    beforeEach(() => {
      db = Database(":memory:");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          slug TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          markdown TEXT NOT NULL,
          marks TEXT NOT NULL DEFAULT '{}',
          revision INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          owner_secret TEXT NOT NULL,
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
      `);
    });

    afterEach(() => {
      db.close();
    });

    it("creates documents table with correct columns", () => {
      const info = db.prepare("PRAGMA table_info(documents)").all();
      const columns = (info as Array<{ name: string }>).map((c) => c.name);
      expect(columns).toContain("slug");
      expect(columns).toContain("markdown");
      expect(columns).toContain("marks");
      expect(columns).toContain("revision");
      expect(columns).toContain("status");
      expect(columns).toContain("owner_secret");
      expect(columns).toContain("expires_at");
    });

    it("enforces foreign key on document_tokens", () => {
      expect(() => {
        db.prepare(
          "INSERT INTO document_tokens (token, slug, role) VALUES ('tok', 'nonexistent', 'viewer')",
        ).run();
      }).toThrow();
    });
  });
});
