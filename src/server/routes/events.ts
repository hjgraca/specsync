import { Router, type Router as RouterType } from "express";
import { getDb } from "../db.js";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";

const router: RouterType = Router();

router.get(
  "/documents/:slug/events/pending",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const since = parseInt(req.query.since as string, 10) || 0;
    const excludeBy = req.query.exclude_by as string | undefined;

    const db = getDb();

    let query = "SELECT id, slug, type, data, actor, created_at FROM events WHERE slug = ? AND id > ?";
    const params: unknown[] = [slug, since];

    if (excludeBy) {
      const pattern = excludeBy.replace("*", "%");
      query += " AND actor NOT LIKE ?";
      params.push(pattern);
    }

    query += " ORDER BY id ASC";

    const rows = db.prepare(query).all(...params) as Array<{
      id: number;
      slug: string;
      type: string;
      data: string;
      actor: string;
      created_at: string;
    }>;

    const events = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      type: row.type,
      data: JSON.parse(row.data),
      actor: row.actor,
      createdAt: row.created_at,
    }));

    res.json({ events });
  },
);

router.post(
  "/documents/:slug/events/ack",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { slug } = req.params;

    if (req.auth!.slug !== slug) {
      res.status(403).json({ error: "Token does not match document", code: "SLUG_MISMATCH" });
      return;
    }

    const { agentId, lastEventId } = req.body as { agentId: string; lastEventId: number };

    if (!agentId || lastEventId === undefined) {
      res.status(400).json({ error: "agentId and lastEventId are required", code: "MISSING_FIELDS" });
      return;
    }

    const db = getDb();
    db.prepare(
      `INSERT INTO event_acks (slug, agent_id, last_event_id)
       VALUES (?, ?, ?)
       ON CONFLICT (slug, agent_id) DO UPDATE SET last_event_id = excluded.last_event_id`,
    ).run(slug, agentId, lastEventId);

    res.json({ success: true, agentId, lastEventId });
  },
);

export default router;
