import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

const app = createApp();

describe("event polling routes", () => {
  let slug: string;
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/documents")
      .send({ title: "Events Test", markdown: "# Events\n\nTest content." });
    slug = res.body.slug;
    accessToken = res.body.accessToken;

    await request(app)
      .post(`/documents/${slug}/ops`)
      .set("x-share-token", accessToken)
      .send({ type: "comment.add", by: "human:alice", quote: "Test content", text: "Comment 1" });

    await request(app)
      .post(`/documents/${slug}/ops`)
      .set("x-share-token", accessToken)
      .send({ type: "comment.add", by: "ai:reviewer", quote: "Events", text: "AI comment" });

    await request(app)
      .post(`/documents/${slug}/ops`)
      .set("x-share-token", accessToken)
      .send({ type: "comment.add", by: "human:bob", quote: "Test content", text: "Comment 3" });
  });

  describe("GET /documents/:slug/events/pending", () => {
    it("returns all events when no since param", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.events.length).toBe(3);
      expect(res.body.events[0].type).toBe("comment.added");
      expect(res.body.events[0].actor).toBe("human:alice");
    });

    it("returns events after since parameter", async () => {
      const all = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken);

      const firstId = all.body.events[0].id;

      const res = await request(app)
        .get(`/documents/${slug}/events/pending?since=${firstId}`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.events.length).toBe(2);
      expect(res.body.events[0].actor).toBe("ai:reviewer");
    });

    it("filters out events by exclude_by pattern", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/events/pending?exclude_by=ai:*`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.events.length).toBe(2);
      expect(res.body.events.every((e: any) => !e.actor.startsWith("ai:"))).toBe(true);
    });

    it("returns empty array when no events exist", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/events/pending?since=999999`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.events).toEqual([]);
    });

    it("returns 401 without token", async () => {
      await request(app)
        .get(`/documents/${slug}/events/pending`)
        .expect(404);
    });
  });

  describe("POST /documents/:slug/events/ack", () => {
    it("acknowledges last processed event", async () => {
      const all = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken);

      const lastId = all.body.events[all.body.events.length - 1].id;

      const res = await request(app)
        .post(`/documents/${slug}/events/ack`)
        .set("x-share-token", accessToken)
        .send({ agentId: "ai:test-agent", lastEventId: lastId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.lastEventId).toBe(lastId);
    });

    it("returns 400 without required fields", async () => {
      await request(app)
        .post(`/documents/${slug}/events/ack`)
        .set("x-share-token", accessToken)
        .send({ agentId: "ai:test" })
        .expect(400);
    });
  });
});
