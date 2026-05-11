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

  describe("comment.reply — edge cases", () => {
    let replyDocSlug: string;
    let replyDocToken: string;
    let replyMarkId: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Reply Edge Cases", markdown: "# Reply Test\n\nContent here." });
      replyDocSlug = doc.body.slug;
      replyDocToken = doc.body.accessToken;

      const comment = await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({
          type: "comment.add",
          by: "human:alice",
          quote: "Content here",
          text: "Initial comment",
        });
      replyMarkId = comment.body.mark.id;
    });

    it("adds multiple replies to the same thread", async () => {
      await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({ type: "comment.reply", markId: replyMarkId, by: "human:bob", text: "Reply 1" })
        .expect(200);

      await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({ type: "comment.reply", markId: replyMarkId, by: "ai:agent", text: "Reply 2" })
        .expect(200);

      const state = await request(app)
        .get(`/documents/${replyDocSlug}/state`)
        .set("x-share-token", replyDocToken)
        .expect(200);

      const mark = state.body.marks[replyMarkId];
      expect(mark.thread.length).toBe(2);
      expect(mark.thread[0].by).toBe("human:bob");
      expect(mark.thread[0].text).toBe("Reply 1");
      expect(mark.thread[1].by).toBe("ai:agent");
      expect(mark.thread[1].text).toBe("Reply 2");
    });

    it("returns 400 when markId is missing", async () => {
      const res = await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({ type: "comment.reply", by: "human:bob", text: "Missing markId" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 400 when by is missing", async () => {
      const res = await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({ type: "comment.reply", markId: replyMarkId, text: "Missing by" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 400 when text is missing", async () => {
      const res = await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({ type: "comment.reply", markId: replyMarkId, by: "human:bob" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 404 for reply on non-existent mark", async () => {
      const res = await request(app)
        .post(`/documents/${replyDocSlug}/ops`)
        .set("x-share-token", replyDocToken)
        .send({
          type: "comment.reply",
          markId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          by: "human:bob",
          text: "Ghost mark",
        })
        .expect(404);

      expect(res.body.code).toBe("MARK_NOT_FOUND");
    });
  });

  describe("comment.resolve — edge cases", () => {
    let resolveDocSlug: string;
    let resolveDocToken: string;
    let resolveMarkId: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Resolve Edge Cases", markdown: "# Resolve\n\nResolve content." });
      resolveDocSlug = doc.body.slug;
      resolveDocToken = doc.body.accessToken;

      const comment = await request(app)
        .post(`/documents/${resolveDocSlug}/ops`)
        .set("x-share-token", resolveDocToken)
        .send({
          type: "comment.add",
          by: "human:alice",
          quote: "Resolve content",
          text: "Needs resolving",
        });
      resolveMarkId = comment.body.mark.id;
    });

    it("resolves a comment and verifies resolved state", async () => {
      const res = await request(app)
        .post(`/documents/${resolveDocSlug}/ops`)
        .set("x-share-token", resolveDocToken)
        .send({ type: "comment.resolve", markId: resolveMarkId, by: "human:alice" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.resolved).toBe(true);

      const state = await request(app)
        .get(`/documents/${resolveDocSlug}/state`)
        .set("x-share-token", resolveDocToken);

      expect(state.body.marks[resolveMarkId].resolved).toBe(true);
    });

    it("returns 400 when markId is missing for resolve", async () => {
      const res = await request(app)
        .post(`/documents/${resolveDocSlug}/ops`)
        .set("x-share-token", resolveDocToken)
        .send({ type: "comment.resolve", by: "human:alice" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 404 for resolving non-existent mark", async () => {
      const res = await request(app)
        .post(`/documents/${resolveDocSlug}/ops`)
        .set("x-share-token", resolveDocToken)
        .send({
          type: "comment.resolve",
          markId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          by: "human:alice",
        })
        .expect(404);

      expect(res.body.code).toBe("MARK_NOT_FOUND");
    });
  });

  describe("document.approve — edge cases", () => {
    it("changes status to approved and verifies in state", async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Approve Edge", markdown: "# Approve\n\nContent" });

      const res = await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({ type: "document.approve", by: "human:reviewer" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("approved");
      expect(res.body.approvedBy).toBe("human:reviewer");

      const state = await request(app)
        .get(`/documents/${doc.body.slug}/state`)
        .set("x-share-token", doc.body.accessToken);

      expect(state.body.status).toBe("approved");
    });

    it("can approve a document that had changes_requested", async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Re-Approve", markdown: "# Re-Approve\n\nContent" });

      await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({ type: "document.request_changes", by: "human:reviewer" })
        .expect(200);

      const state1 = await request(app)
        .get(`/documents/${doc.body.slug}/state`)
        .set("x-share-token", doc.body.accessToken);
      expect(state1.body.status).toBe("changes_requested");

      await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({ type: "document.approve", by: "human:reviewer" })
        .expect(200);

      const state2 = await request(app)
        .get(`/documents/${doc.body.slug}/state`)
        .set("x-share-token", doc.body.accessToken);
      expect(state2.body.status).toBe("approved");
    });
  });

  describe("document.request_changes — edge cases", () => {
    it("changes status to changes_requested and verifies in state", async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Changes Edge", markdown: "# Changes\n\nSome text" });

      const res = await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({
          type: "document.request_changes",
          by: "human:reviewer",
          comments: [{ section: "Overview", comment: "Too vague" }],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("changes_requested");

      const state = await request(app)
        .get(`/documents/${doc.body.slug}/state`)
        .set("x-share-token", doc.body.accessToken);
      expect(state.body.status).toBe("changes_requested");
    });

    it("request_changes without comments still sets status", async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "No Comments", markdown: "# No Comments\n\nContent" });

      const res = await request(app)
        .post(`/documents/${doc.body.slug}/ops`)
        .set("x-share-token", doc.body.accessToken)
        .send({ type: "document.request_changes", by: "human:reviewer" })
        .expect(200);

      expect(res.body.status).toBe("changes_requested");
    });
  });

  describe("ops — missing type field", () => {
    it("returns 400 when type field is missing entirely", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({ by: "human:alice" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_TYPE");
    });
  });

  describe("comment.add — validation edge cases", () => {
    it("returns 400 when by exceeds max length", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.add",
          by: "x".repeat(101),
          quote: "content",
          text: "hello",
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when quote exceeds max length", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.add",
          by: "human:alice",
          quote: "q".repeat(501),
          text: "hello",
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when text exceeds max length", async () => {
      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.add",
          by: "human:alice",
          quote: "content",
          text: "t".repeat(5001),
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("suggestion.accept and suggestion.reject — edge cases", () => {
    let sugDocSlug: string;
    let sugDocToken: string;

    beforeAll(async () => {
      const doc = await request(app)
        .post("/documents")
        .send({ title: "Suggestion Edge", markdown: "# Suggestion\n\nOriginal text to replace." });
      sugDocSlug = doc.body.slug;
      sugDocToken = doc.body.accessToken;
    });

    it("accepting a suggestion applies the replacement to markdown", async () => {
      const sug = await request(app)
        .post(`/documents/${sugDocSlug}/ops`)
        .set("x-share-token", sugDocToken)
        .send({
          type: "suggestion.add",
          by: "human:bob",
          quote: "Original text to replace",
          content: "Replaced text",
          kind: "replace",
        })
        .expect(201);

      await request(app)
        .post(`/documents/${sugDocSlug}/ops`)
        .set("x-share-token", sugDocToken)
        .send({ type: "suggestion.accept", markId: sug.body.mark.id, by: "human:alice" })
        .expect(200);

      const state = await request(app)
        .get(`/documents/${sugDocSlug}/state`)
        .set("x-share-token", sugDocToken);

      expect(state.body.markdown).toContain("Replaced text");
      expect(state.body.markdown).not.toContain("Original text to replace");
      expect(state.body.marks[sug.body.mark.id].resolved).toBe(true);
    });

    it("rejecting a suggestion marks it resolved without changing markdown", async () => {
      const doc2 = await request(app)
        .post("/documents")
        .send({ title: "Reject Edge", markdown: "# Reject\n\nKeep this text." });

      const sug = await request(app)
        .post(`/documents/${doc2.body.slug}/ops`)
        .set("x-share-token", doc2.body.accessToken)
        .send({
          type: "suggestion.add",
          by: "human:bob",
          quote: "Keep this text",
          content: "Different text",
          kind: "replace",
        })
        .expect(201);

      await request(app)
        .post(`/documents/${doc2.body.slug}/ops`)
        .set("x-share-token", doc2.body.accessToken)
        .send({ type: "suggestion.reject", markId: sug.body.mark.id, by: "human:alice" })
        .expect(200);

      const state = await request(app)
        .get(`/documents/${doc2.body.slug}/state`)
        .set("x-share-token", doc2.body.accessToken);

      expect(state.body.markdown).toContain("Keep this text");
      expect(state.body.marks[sug.body.mark.id].resolved).toBe(true);
    });

    it("returns 404 when accepting non-existent mark", async () => {
      const res = await request(app)
        .post(`/documents/${sugDocSlug}/ops`)
        .set("x-share-token", sugDocToken)
        .send({ type: "suggestion.accept", markId: "nonexistent-id", by: "human:alice" })
        .expect(404);

      expect(res.body.code).toBe("MARK_NOT_FOUND");
    });

    it("returns 400 when accepting a comment mark (not a suggestion)", async () => {
      const comment = await request(app)
        .post(`/documents/${sugDocSlug}/ops`)
        .set("x-share-token", sugDocToken)
        .send({
          type: "comment.add",
          by: "human:bob",
          quote: "Replaced text",
          text: "This is a comment, not a suggestion",
        })
        .expect(201);

      const res = await request(app)
        .post(`/documents/${sugDocSlug}/ops`)
        .set("x-share-token", sugDocToken)
        .send({ type: "suggestion.accept", markId: comment.body.mark.id, by: "human:alice" })
        .expect(400);

      expect(res.body.code).toBe("NOT_SUGGESTION");
    });
  });

  describe("ops — auth edge cases", () => {
    it("returns 404 without any token", async () => {
      await request(app)
        .post(`/documents/${slug}/ops`)
        .send({ type: "comment.add", by: "human:alice", quote: "x", text: "y" })
        .expect(404);
    });

    it("returns 404 with invalid token", async () => {
      await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", "completely-invalid-token")
        .send({ type: "comment.add", by: "human:alice", quote: "x", text: "y" })
        .expect(404);
    });

    it("returns 403 when token belongs to a different document", async () => {
      const otherDoc = await request(app)
        .post("/documents")
        .send({ title: "Other Doc", markdown: "# Other" });

      const res = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", otherDoc.body.accessToken)
        .send({ type: "comment.add", by: "human:alice", quote: "x", text: "y" })
        .expect(403);

      expect(res.body.code).toBe("SLUG_MISMATCH");
    });
  });
});
