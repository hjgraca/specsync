import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { getDb } from "./db.js";
import type { AccessRole } from "../shared/types.js";

export interface AuthenticatedRequest extends Request {
  auth?: {
    slug: string;
    role: AccessRole;
    token: string;
  };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const shareToken = req.headers["x-share-token"] as string | undefined;
  if (shareToken) {
    return shareToken;
  }

  const queryToken = req.query.token as string | undefined;
  if (queryToken) {
    return queryToken;
  }

  return null;
}

export function extractJoinCode(req: Request): string | null {
  const header = req.headers["x-join-code"] as string | undefined;
  if (header) return header;

  const queryCode = req.query.code as string | undefined;
  if (queryCode) return queryCode;

  return null;
}

/** Constant-time comparison that tolerates differing lengths without throwing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.slug AS slug, t.role AS role, d.join_code AS joinCode
       FROM document_tokens t
       JOIN documents d ON d.slug = t.slug
       WHERE t.token = ?`,
    )
    .get(token) as { slug: string; role: AccessRole; joinCode: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }

  // A valid token is necessary but not sufficient: the document's join code is a
  // required second factor. Docs created before join codes existed have an empty
  // code and stay open so the token alone keeps working.
  if (row.joinCode) {
    const code = extractJoinCode(req);
    if (!code || !safeEqual(code, row.joinCode)) {
      res.status(403).json({ error: "Invalid or missing join code", code: "INVALID_JOIN_CODE" });
      return;
    }
  }

  req.auth = { slug: row.slug, role: row.role, token };
  next();
}


export function requireRole(...roles: AccessRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required", code: "NO_TOKEN" });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: "Insufficient permissions",
        code: "FORBIDDEN",
        required: roles,
        actual: req.auth.role,
      });
      return;
    }

    next();
  };
}

export function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ownerSecret =
    (req.headers["x-owner-secret"] as string) ||
    (req.body?.ownerSecret as string);

  if (!ownerSecret) {
    res.status(403).json({ error: "Owner secret required", code: "NO_OWNER_SECRET" });
    return;
  }

  const slug = req.params.slug;
  const db = getDb();
  const row = db
    .prepare("SELECT owner_secret FROM documents WHERE slug = ?")
    .get(slug) as { owner_secret: string } | undefined;

  if (!row) {
    res.status(403).json({ error: "Invalid owner secret", code: "INVALID_OWNER" });
    return;
  }

  const a = Buffer.from(row.owner_secret);
  const b = Buffer.from(ownerSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(403).json({ error: "Invalid owner secret", code: "INVALID_OWNER" });
    return;
  }

  next();
}
