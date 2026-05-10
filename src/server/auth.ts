import type { Request, Response, NextFunction } from "express";
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
    .prepare("SELECT slug, role FROM document_tokens WHERE token = ?")
    .get(token) as { slug: string; role: AccessRole } | undefined;

  if (!row) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
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

  if (!row || row.owner_secret !== ownerSecret) {
    res.status(403).json({ error: "Invalid owner secret", code: "INVALID_OWNER" });
    return;
  }

  next();
}
