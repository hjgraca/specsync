import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";
import { getDb } from "../../src/server/db.js";
import {
  extractToken,
  requireAuth,
  requireOwner,
  requireRole,
  type AuthenticatedRequest,
} from "../../src/server/auth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed a document + token row so the middleware can look them up. */
function seedDocument(slug: string, ownerSecret: string) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO documents (slug, title, markdown, owner_secret, expires_at)
     VALUES (?, 'Test', '# hi', ?, datetime('now', '+1 hour'))`,
  ).run(slug, ownerSecret);
}

function seedToken(token: string, slug: string, role = "commenter") {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO document_tokens (token, slug, role) VALUES (?, ?, ?)`,
  ).run(token, slug, role);
}

// ---------------------------------------------------------------------------
// extractToken  (pure function -- no DB needed)
// ---------------------------------------------------------------------------

describe("extractToken", () => {
  it("extracts token from Bearer authorization header", () => {
    const req = {
      headers: { authorization: "Bearer my-secret-token" },
      query: {},
    } as unknown as Request;

    expect(extractToken(req)).toBe("my-secret-token");
  });

  it("extracts token from x-share-token header", () => {
    const req = {
      headers: { "x-share-token": "share-tok" },
      query: {},
    } as unknown as Request;

    expect(extractToken(req)).toBe("share-tok");
  });

  it("extracts token from query parameter", () => {
    const req = {
      headers: {},
      query: { token: "query-tok" },
    } as unknown as Request;

    expect(extractToken(req)).toBe("query-tok");
  });

  it("returns null when no token is present", () => {
    const req = {
      headers: {},
      query: {},
    } as unknown as Request;

    expect(extractToken(req)).toBeNull();
  });

  it("prefers Bearer header over x-share-token and query", () => {
    const req = {
      headers: {
        authorization: "Bearer bearer-tok",
        "x-share-token": "share-tok",
      },
      query: { token: "query-tok" },
    } as unknown as Request;

    expect(extractToken(req)).toBe("bearer-tok");
  });

  it("prefers x-share-token over query param when no Bearer", () => {
    const req = {
      headers: { "x-share-token": "share-tok" },
      query: { token: "query-tok" },
    } as unknown as Request;

    expect(extractToken(req)).toBe("share-tok");
  });

  it("ignores authorization header that is not Bearer scheme", () => {
    const req = {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
      query: {},
    } as unknown as Request;

    expect(extractToken(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireAuth  (needs a live SQLite DB)
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  const SLUG = "test-slug";
  const VALID_TOKEN = "valid-token-abc";

  beforeEach(() => {
    // Force a fresh in-memory DB for each test
    process.env.REVIEW_TOOL_DB_PATH = ":memory:";
    // Reset the cached db singleton so getDb() creates a new one
    // We do this by deleting the module-level variable through a re-import trick:
    // Instead, we just ensure the DB has been initialised and seed data.
    const db = getDb();
    seedDocument(SLUG, "owner-secret-123");
    seedToken(VALID_TOKEN, SLUG, "editor");
  });

  afterEach(() => {
    delete process.env.REVIEW_TOOL_DB_PATH;
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.get("/protected", requireAuth, (req: AuthenticatedRequest, res: Response) => {
      res.json({ ok: true, auth: req.auth });
    });
    return app;
  }

  it("passes and populates req.auth with a valid token in Bearer header", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.auth).toEqual({
      slug: SLUG,
      role: "editor",
      token: VALID_TOKEN,
    });
  });

  it("passes with a valid token in x-share-token header", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/protected")
      .set("x-share-token", VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.auth.slug).toBe(SLUG);
  });

  it("passes with a valid token in query param", async () => {
    const app = buildApp();
    const res = await request(app)
      .get(`/protected?token=${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.auth.slug).toBe(SLUG);
  });

  it("returns 404 when token is missing entirely", async () => {
    const app = buildApp();
    const res = await request(app).get("/protected");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });

  it("returns 404 when token is not in the database", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer nonexistent-token");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// requireOwner  (needs a live SQLite DB)
// ---------------------------------------------------------------------------

describe("requireOwner", () => {
  const SLUG = "owner-test-slug";
  const OWNER_SECRET = "super-secret-owner-key";

  beforeEach(() => {
    process.env.REVIEW_TOOL_DB_PATH = ":memory:";
    const db = getDb();
    seedDocument(SLUG, OWNER_SECRET);
  });

  afterEach(() => {
    delete process.env.REVIEW_TOOL_DB_PATH;
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.post("/documents/:slug/owner-action", requireOwner, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("passes when the correct owner secret is in x-owner-secret header", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`)
      .set("x-owner-secret", OWNER_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("passes when the correct owner secret is in the request body", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`)
      .send({ ownerSecret: OWNER_SECRET });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 403 when the owner secret is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_OWNER_SECRET");
  });

  it("returns 403 when the owner secret is wrong", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`)
      .set("x-owner-secret", "wrong-secret");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_OWNER");
  });

  it("returns 403 when the slug does not exist in the database", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/documents/nonexistent-slug/owner-action")
      .set("x-owner-secret", OWNER_SECRET);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_OWNER");
  });

  it("uses timing-safe comparison (wrong secret of same length still rejected)", async () => {
    // Build a secret with the exact same length as the real one
    const wrongSameLength = "x".repeat(OWNER_SECRET.length);
    expect(wrongSameLength.length).toBe(OWNER_SECRET.length);

    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`)
      .set("x-owner-secret", wrongSameLength);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_OWNER");
  });

  it("rejects when the owner secret has different length (timing-safe early exit)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/documents/${SLUG}/owner-action`)
      .set("x-owner-secret", "short");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_OWNER");
  });
});

// ---------------------------------------------------------------------------
// requireRole  (no DB -- operates on req.auth set by requireAuth)
// ---------------------------------------------------------------------------

describe("requireRole", () => {
  function buildApp(allowedRoles: Array<"viewer" | "commenter" | "editor" | "owner">) {
    const app = express();
    app.use(express.json());

    // Manually attach auth to simulate requireAuth having already run
    app.use((req: AuthenticatedRequest, _res, next) => {
      const role = req.headers["x-test-role"] as string | undefined;
      if (role) {
        req.auth = {
          slug: "test-slug",
          role: role as "viewer" | "commenter" | "editor" | "owner",
          token: "test-token",
        };
      }
      next();
    });

    app.get("/role-protected", requireRole(...allowedRoles), (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("passes when the user has one of the allowed roles", async () => {
    const app = buildApp(["editor", "owner"]);
    const res = await request(app)
      .get("/role-protected")
      .set("x-test-role", "editor");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("passes with owner role when owner is allowed", async () => {
    const app = buildApp(["owner"]);
    const res = await request(app)
      .get("/role-protected")
      .set("x-test-role", "owner");

    expect(res.status).toBe(200);
  });

  it("returns 403 when the user role is not in the allowed list", async () => {
    const app = buildApp(["editor", "owner"]);
    const res = await request(app)
      .get("/role-protected")
      .set("x-test-role", "viewer");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(res.body.required).toEqual(["editor", "owner"]);
    expect(res.body.actual).toBe("viewer");
  });

  it("returns 403 for commenter when only editor is allowed", async () => {
    const app = buildApp(["editor"]);
    const res = await request(app)
      .get("/role-protected")
      .set("x-test-role", "commenter");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns 401 when req.auth is not set (no authentication)", async () => {
    const app = buildApp(["editor"]);
    const res = await request(app).get("/role-protected");
    // No x-test-role header => req.auth is undefined

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NO_TOKEN");
  });

  it("allows a single role argument", async () => {
    const app = buildApp(["commenter"]);
    const res = await request(app)
      .get("/role-protected")
      .set("x-test-role", "commenter");

    expect(res.status).toBe(200);
  });

  it("allows all four role values when all are specified", async () => {
    const app = buildApp(["viewer", "commenter", "editor", "owner"]);

    for (const role of ["viewer", "commenter", "editor", "owner"]) {
      const res = await request(app)
        .get("/role-protected")
        .set("x-test-role", role);
      expect(res.status).toBe(200);
    }
  });
});
