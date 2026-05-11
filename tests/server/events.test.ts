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

  describe("events recorded on comment operations", () => {
    let evSlug: string;
    let evToken: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Event Recording", markdown: "# Event Recording\n\nEvent content here." });
      evSlug = doc.body.slug;
      evToken = doc.body.accessToken;
    });

    it("records a comment.added event when a comment is created", async () => {
      await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "comment.add", by: "human:eve", quote: "Event content", text: "New comment" })
        .expect(201);

      const events = await request(app)
        .get(`/documents/${evSlug}/events/pending`)
        .set("x-share-token", evToken)
        .expect(200);

      expect(events.body.events.length).toBeGreaterThanOrEqual(1);
      const commentEvent = events.body.events.find((e: any) => e.type === "comment.added");
      expect(commentEvent).toBeDefined();
      expect(commentEvent.actor).toBe("human:eve");
      expect(commentEvent.data.text).toBe("New comment");
    });

    it("records a comment.replied event when a reply is added", async () => {
      const comment = await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "comment.add", by: "human:dan", quote: "Event content here", text: "Thread start" });

      const markId = comment.body.mark.id;

      await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "comment.reply", markId, by: "ai:helper", text: "Thread reply" })
        .expect(200);

      const events = await request(app)
        .get(`/documents/${evSlug}/events/pending`)
        .set("x-share-token", evToken)
        .expect(200);

      const replyEvent = events.body.events.find((e: any) => e.type === "comment.replied");
      expect(replyEvent).toBeDefined();
      expect(replyEvent.actor).toBe("ai:helper");
      expect(replyEvent.data.markId).toBe(markId);
    });

    it("records a comment.resolved event when comment is resolved", async () => {
      const comment = await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "comment.add", by: "human:fay", quote: "Event content", text: "Will resolve" });

      const markId = comment.body.mark.id;

      await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "comment.resolve", markId, by: "human:fay" })
        .expect(200);

      const events = await request(app)
        .get(`/documents/${evSlug}/events/pending`)
        .set("x-share-token", evToken)
        .expect(200);

      const resolvedEvent = events.body.events.find((e: any) => e.type === "comment.resolved");
      expect(resolvedEvent).toBeDefined();
      expect(resolvedEvent.actor).toBe("human:fay");
    });

    it("records a document.approved event on approval", async () => {
      await request(app)
        .post(`/documents/${evSlug}/ops`)
        .set("x-share-token", evToken)
        .send({ type: "document.approve", by: "human:approver" })
        .expect(200);

      const events = await request(app)
        .get(`/documents/${evSlug}/events/pending`)
        .set("x-share-token", evToken)
        .expect(200);

      const approvedEvent = events.body.events.find((e: any) => e.type === "document.approved");
      expect(approvedEvent).toBeDefined();
      expect(approvedEvent.actor).toBe("human:approver");
    });

    it("records a document.changes_requested event on request_changes", async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Changes Events", markdown: "# Changes Events\n\nBody." });

      await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({
          type: "document.request_changes",
          by: "human:pm",
          comments: [{ section: "Body", comment: "Expand this" }],
        })
        .expect(200);

      const events = await request(app)
        .get(`/documents/${doc.body.slug}/events/pending`)
        .set("x-share-token", doc.body.accessToken)
        .expect(200);

      const changesEvent = events.body.events.find(
        (e: any) => e.type === "document.changes_requested",
      );
      expect(changesEvent).toBeDefined();
      expect(changesEvent.actor).toBe("human:pm");
    });
  });

  describe("exclude_by filtering — edge cases", () => {
    let filtSlug: string;
    let filtToken: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Filter Test", markdown: "# Filter\n\nFilter content." });
      filtSlug = doc.body.slug;
      filtToken = doc.body.accessToken;

      // Create events from different actor types
      await request(app)
        .post(`/documents/${filtSlug}/ops`)
        .set("x-share-token", filtToken)
        .send({ type: "comment.add", by: "human:alice", quote: "Filter content", text: "Human 1" });

      await request(app)
        .post(`/documents/${filtSlug}/ops`)
        .set("x-share-token", filtToken)
        .send({ type: "comment.add", by: "ai:reviewer", quote: "Filter", text: "AI 1" });

      await request(app)
        .post(`/documents/${filtSlug}/ops`)
        .set("x-share-token", filtToken)
        .send({ type: "comment.add", by: "ai:pm-agent", quote: "Filter content", text: "AI 2" });

      await request(app)
        .post(`/documents/${filtSlug}/ops`)
        .set("x-share-token", filtToken)
        .send({ type: "comment.add", by: "human:bob", quote: "Filter", text: "Human 2" });
    });

    it("exclude_by with ai:* wildcard filters all AI actors", async () => {
      const res = await request(app)
        .get(`/documents/${filtSlug}/events/pending?exclude_by=ai:*`)
        .set("x-share-token", filtToken)
        .expect(200);

      expect(res.body.events.length).toBe(2);
      expect(res.body.events.every((e: any) => e.actor.startsWith("human:"))).toBe(true);
    });

    it("exclude_by with human:* wildcard filters all human actors", async () => {
      const res = await request(app)
        .get(`/documents/${filtSlug}/events/pending?exclude_by=human:*`)
        .set("x-share-token", filtToken)
        .expect(200);

      expect(res.body.events.length).toBe(2);
      expect(res.body.events.every((e: any) => e.actor.startsWith("ai:"))).toBe(true);
    });

    it("exclude_by with exact actor name filters only that actor", async () => {
      const res = await request(app)
        .get(`/documents/${filtSlug}/events/pending?exclude_by=ai:reviewer`)
        .set("x-share-token", filtToken)
        .expect(200);

      expect(res.body.events.length).toBe(3);
      expect(res.body.events.every((e: any) => e.actor !== "ai:reviewer")).toBe(true);
    });

    it("exclude_by with non-matching pattern returns all events", async () => {
      const res = await request(app)
        .get(`/documents/${filtSlug}/events/pending?exclude_by=system:*`)
        .set("x-share-token", filtToken)
        .expect(200);

      expect(res.body.events.length).toBe(4);
    });
  });

  describe("since parameter — edge cases", () => {
    let sinceSlug: string;
    let sinceToken: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Since Test", markdown: "# Since\n\nSince content." });
      sinceSlug = doc.body.slug;
      sinceToken = doc.body.accessToken;

      await request(app)
        .post(`/documents/${sinceSlug}/ops`)
        .set("x-share-token", sinceToken)
        .send({ type: "comment.add", by: "human:alice", quote: "Since content", text: "First" });

      await request(app)
        .post(`/documents/${sinceSlug}/ops`)
        .set("x-share-token", sinceToken)
        .send({ type: "comment.add", by: "human:bob", quote: "Since", text: "Second" });

      await request(app)
        .post(`/documents/${sinceSlug}/ops`)
        .set("x-share-token", sinceToken)
        .send({ type: "comment.add", by: "human:carol", quote: "Since content", text: "Third" });
    });

    it("since returns only events after the given ID", async () => {
      const all = await request(app)
        .get(`/documents/${sinceSlug}/events/pending`)
        .set("x-share-token", sinceToken);

      expect(all.body.events.length).toBe(3);

      const secondId = all.body.events[1].id;
      const res = await request(app)
        .get(`/documents/${sinceSlug}/events/pending?since=${secondId}`)
        .set("x-share-token", sinceToken)
        .expect(200);

      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].actor).toBe("human:carol");
    });

    it("since with the last event ID returns empty array", async () => {
      const all = await request(app)
        .get(`/documents/${sinceSlug}/events/pending`)
        .set("x-share-token", sinceToken);

      const lastId = all.body.events[all.body.events.length - 1].id;
      const res = await request(app)
        .get(`/documents/${sinceSlug}/events/pending?since=${lastId}`)
        .set("x-share-token", sinceToken)
        .expect(200);

      expect(res.body.events).toEqual([]);
    });

    it("since=0 returns all events (default behavior)", async () => {
      const res = await request(app)
        .get(`/documents/${sinceSlug}/events/pending?since=0`)
        .set("x-share-token", sinceToken)
        .expect(200);

      expect(res.body.events.length).toBe(3);
    });

    it("since combined with exclude_by filters both", async () => {
      // Add an AI event
      await request(app)
        .post(`/documents/${sinceSlug}/ops`)
        .set("x-share-token", sinceToken)
        .send({ type: "comment.add", by: "ai:bot", quote: "Since content", text: "AI event" });

      const all = await request(app)
        .get(`/documents/${sinceSlug}/events/pending`)
        .set("x-share-token", sinceToken);

      expect(all.body.events.length).toBe(4);

      const firstId = all.body.events[0].id;
      const res = await request(app)
        .get(`/documents/${sinceSlug}/events/pending?since=${firstId}&exclude_by=ai:*`)
        .set("x-share-token", sinceToken)
        .expect(200);

      // Should exclude AI events and only return events after firstId
      expect(res.body.events.every((e: any) => !e.actor.startsWith("ai:"))).toBe(true);
      expect(res.body.events.every((e: any) => e.id > firstId)).toBe(true);
    });
  });

  describe("events — auth edge cases", () => {
    it("returns 404 for non-existent slug with invalid token", async () => {
      await request(app)
        .get("/documents/0000000000000000/events/pending")
        .set("x-share-token", "fake-invalid-token")
        .expect(404);
    });

    it("returns 404 for events endpoint without any token", async () => {
      await request(app)
        .get(`/documents/${slug}/events/pending`)
        .expect(404);
    });

    it("returns 403 when token belongs to a different document", async () => {
      const otherDoc = await request(app)
        .post("/documents")
        .send({ title: "Other Events", markdown: "# Other" });

      const res = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", otherDoc.body.accessToken)
        .expect(403);

      expect(res.body.code).toBe("SLUG_MISMATCH");
    });
  });

  describe("events — event data structure", () => {
    it("each event has required fields: id, slug, type, data, actor, createdAt", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken)
        .expect(200);

      for (const event of res.body.events) {
        expect(event.id).toBeTypeOf("number");
        expect(event.slug).toBe(slug);
        expect(event.type).toBeTypeOf("string");
        expect(event.data).toBeTypeOf("object");
        expect(event.actor).toBeTypeOf("string");
        expect(event.createdAt).toBeTypeOf("string");
      }
    });

    it("events are ordered by ID ascending", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken)
        .expect(200);

      for (let i = 1; i < res.body.events.length; i++) {
        expect(res.body.events[i].id).toBeGreaterThan(res.body.events[i - 1].id);
      }
    });
  });

  describe("POST /documents/:slug/events/ack — edge cases", () => {
    it("returns 400 without agentId", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/events/ack`)
        .set("x-share-token", accessToken)
        .send({ lastEventId: 1 })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("upserts ack for same agentId (updates lastEventId)", async () => {
      const all = await request(app)
        .get(`/documents/${slug}/events/pending`)
        .set("x-share-token", accessToken);

      const firstId = all.body.events[0].id;
      const lastId = all.body.events[all.body.events.length - 1].id;

      // First ack
      await request(app)
        .post(`/documents/${slug}/events/ack`)
        .set("x-share-token", accessToken)
        .send({ agentId: "ai:upsert-agent", lastEventId: firstId })
        .expect(200);

      // Second ack with updated lastEventId
      const res = await request(app)
        .post(`/documents/${slug}/events/ack`)
        .set("x-share-token", accessToken)
        .send({ agentId: "ai:upsert-agent", lastEventId: lastId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.lastEventId).toBe(lastId);
    });
  });
});
