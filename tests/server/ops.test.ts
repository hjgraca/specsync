import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

const app = createApp();

describe("operations routes", () => {
  let slug: string;
  let accessToken: string;
  let markId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/documents")
      .send({ title: "Ops Test", markdown: "# Test\n\nSome content to comment on." });
    slug = res.body.slug;
    accessToken = res.body.accessToken;
  });

  describe("comment.add", () => {
    it("adds a comment anchored to quoted text", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.add",
          by: "human:alice",
          quote: "Some content",
          text: "This needs work",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.mark.id).toBeDefined();
      expect(res.body.mark.type).toBe("comment");
      expect(res.body.mark.by).toBe("human:alice");
      expect(res.body.mark.quote).toBe("Some content");
      expect(res.body.mark.text).toBe("This needs work");
      expect(res.body.mark.resolved).toBe(false);
      markId = res.body.mark.id;
    });

    it("returns 400 without required fields", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({ type: "comment.add", by: "human:alice" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 401 without token", async () => {
      await request(app)
        .post(`/documents/${slug}/ops`)
        .send({ type: "comment.add", by: "human:alice", quote: "x", text: "y" })
        .expect(404);
    });
  });

  describe("comment.reply", () => {
    it("adds a reply to an existing comment thread", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.reply",
          markId,
          by: "ai:pm-agent",
          text: "I'll fix this",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.entry.by).toBe("ai:pm-agent");
      expect(res.body.entry.text).toBe("I'll fix this");
    });

    it("returns 404 for non-existent mark", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.reply",
          markId: "non-existent-id",
          by: "human:bob",
          text: "hello",
        })
        .expect(404);

      expect(res.body.code).toBe("MARK_NOT_FOUND");
    });
  });

  describe("suggestion.add", () => {
    it("adds a suggestion with quote and replacement content", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "suggestion.add",
          by: "human:bob",
          quote: "Some content to comment on",
          content: "Improved content here",
          kind: "replace",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.mark.type).toBe("suggestion");
      expect(res.body.mark.content).toBe("Improved content here");
      expect(res.body.mark.kind).toBe("replace");
    });
  });

  describe("comment.resolve", () => {
    it("resolves a comment", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.resolve",
          markId,
          by: "human:alice",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.resolved).toBe(true);
    });

    it("mark shows as resolved in document state", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.marks[markId].resolved).toBe(true);
    });
  });

  describe("document.approve", () => {
    it("approves the document", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "document.approve",
          by: "human:henri",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("approved");
    });

    it("document state shows approved status", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.status).toBe("approved");
    });
  });

  describe("document.request_changes", () => {
    it("requests changes on a document", async () => {
      const createRes = await request(app)
        .post("/documents")
        .send({ title: "Another Doc", markdown: "# Another" });

      const res = await request(app)
        .post(`/documents/${createRes.body.slug}/ops`)
        .set("x-share-token", createRes.body.accessToken)
        .send({
          type: "document.request_changes",
          by: "human:henri",
          comments: [{ section: "Intro", comment: "Needs more detail" }],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("changes_requested");
    });
  });

  describe("revision tracking", () => {
    it("does not increment revision on ops (only content updates do)", async () => {
      const createRes = await request(app)
        .post("/documents")
        .send({ title: "Rev Test", markdown: "# Rev" });

      const token = createRes.body.accessToken;
      const s = createRes.body.slug;

      const state1 = await request(app).get(`/documents/${s}/state`).set("x-share-token", token);
      expect(state1.body.revision).toBe(1);

      await request(app)
        .post(`/documents/${s}/ops`)
        .set("x-share-token", token)
        .send({ type: "comment.add", by: "human:x", quote: "Rev", text: "hi" });

      const state2 = await request(app).get(`/documents/${s}/state`).set("x-share-token", token);
      expect(state2.body.revision).toBe(1);
    });
  });

  describe("unknown operation type", () => {
    it("returns 400 for unknown type", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({ type: "unknown.operation" })
        .expect(400);

      expect(res.body.code).toBe("UNKNOWN_TYPE");
    });
  });
});
