import { Router, type Router as RouterType } from "express";
import type { WebSocket } from "ws";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";
import { getDb } from "../db.js";
import type { PresenceEntry } from "../../shared/types.js";

const router: RouterType = Router();

const presenceMap = new Map<string, Map<string, PresenceEntry>>();

export function getPresenceForSlug(slug: string): PresenceEntry[] {
  const entries = presenceMap.get(slug);
  return entries ? Array.from(entries.values()) : [];
}

export function addPresence(slug: string, entry: PresenceEntry): void {
  if (!presenceMap.has(slug)) {
    presenceMap.set(slug, new Map());
  }
  presenceMap.get(slug)!.set(entry.id, entry);
}

export function removePresence(slug: string, id: string): void {
  const entries = presenceMap.get(slug);
  if (entries) {
    entries.delete(id);
    if (entries.size === 0) {
      presenceMap.delete(slug);
    }
  }
}

router.get("/documents/:slug/presence", requireAuth, (req: AuthenticatedRequest, res) => {
  const { slug } = req.params;
  if (req.auth!.slug !== slug) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }
  res.json({ presence: getPresenceForSlug(slug) });
});

router.post("/documents/:slug/presence", requireAuth, (req: AuthenticatedRequest, res) => {
  const { slug } = req.params;
  if (req.auth!.slug !== slug) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }
  const { id, name, role, status } = req.body as Partial<PresenceEntry>;

  if (!id || !name) {
    res.status(400).json({ error: "id and name are required", code: "MISSING_FIELDS" });
    return;
  }

  const entry: PresenceEntry = {
    id,
    name,
    role: role || "viewer",
    status,
    connectedAt: new Date().toISOString(),
  };

  addPresence(slug, entry);
  res.json({ success: true, entry });
});

function validateQAToken(req: any): boolean {
  const { sessionId } = req.params;
  const token = req.query.token || req.headers["x-share-token"];
  if (!token) return false;
  const db = getDb();
  const row = db.prepare("SELECT token FROM qa_sessions WHERE id = ?").get(sessionId) as { token: string } | undefined;
  return !!(row && row.token === token);
}

router.get("/qa/sessions/:sessionId/presence", (req, res) => {
  if (!validateQAToken(req)) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }
  const { sessionId } = req.params;
  res.json({ presence: getPresenceForSlug(sessionId) });
});

router.post("/qa/sessions/:sessionId/presence", (req, res) => {
  if (!validateQAToken(req)) {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return;
  }
  const { sessionId } = req.params;
  const { id, name, role, status } = req.body as Partial<PresenceEntry>;

  if (!id || !name) {
    res.status(400).json({ error: "id and name are required", code: "MISSING_FIELDS" });
    return;
  }

  const entry: PresenceEntry = {
    id,
    name,
    role: role || "viewer",
    status,
    connectedAt: new Date().toISOString(),
  };

  addPresence(sessionId, entry);
  res.json({ success: true, entry });
});

export interface WsClient {
  ws: WebSocket;
  slug: string;
  id: string;
  name: string;
}

const wsClients = new Set<WsClient>();

export function handleWsConnection(ws: WebSocket, slug: string, id: string, name: string): void {
  const client: WsClient = { ws, slug, id, name };
  wsClients.add(client);

  addPresence(slug, { id, name, role: "viewer", connectedAt: new Date().toISOString() });
  broadcastPresence(slug);

  ws.on("close", () => {
    wsClients.delete(client);
    removePresence(slug, id);
    broadcastPresence(slug);
  });
}

function broadcastPresence(slug: string): void {
  const presence = getPresenceForSlug(slug);
  const message = JSON.stringify({ type: "presence", presence });

  for (const client of wsClients) {
    if (client.slug === slug && client.ws.readyState === 1) {
      client.ws.send(message);
    }
  }
}

export default router;
