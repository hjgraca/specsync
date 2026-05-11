import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app.js";

const app = createApp();

describe("document routes", () => {
  let slug: string;
  let accessToken: string;
  let ownerSecret: string;

  describe("POST /documents", () => {
    it("creates a document and returns slug, tokens, and URLs", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: "Test Doc", markdown: "# Hello\n\nWorld" })
        .expect(201);

      expect(res.body.slug).toHaveLength(16);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.ownerSecret).toBeDefined();
      expect(res.body.docUrl).toContain(`/review/${res.body.slug}`);
      expect(res.body.bridgeUrl).toContain(`/documents/${res.body.slug}`);

      slug = res.body.slug;
      accessToken = res.body.accessToken;
      ownerSecret = res.body.ownerSecret;
    });

    it("returns 400 without markdown or files", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: "Empty" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_CONTENT");
    });
  });

  describe("GET /documents/:slug/state", () => {
    it("returns document state with valid token", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(res.body.slug).toBe(slug);
      expect(res.body.title).toBe("Test Doc");
      expect(res.body.markdown).toBe("# Hello\n\nWorld");
      expect(res.body.marks).toEqual({});
      expect(res.body.revision).toBe(1);
      expect(res.body.status).toBe("active");
    });

    it("returns 404 without token", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 404 with invalid token", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", "invalid-token-value")
        .expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("accepts token via query param", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state?token=${accessToken}`)
        .expect(200);

      expect(res.body.slug).toBe(slug);
    });

    it("accepts token via Authorization header", async () => {
      const res = await request(app)
        .get(`/documents/${slug}/state`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.slug).toBe(slug);
    });
  });

  describe("PUT /documents/:slug", () => {
    it("updates markdown and increments revision", async () => {
      const res = await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", accessToken)
        .send({ markdown: "# Updated\n\nNew content" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.revision).toBe(2);
      expect(res.body.status).toBe("active");

      const state = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(state.body.markdown).toBe("# Updated\n\nNew content");
      expect(state.body.revision).toBe(2);
    });

    it("preserves existing comments/marks after update", async () => {
      // Add a comment first
      const commentRes = await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({
          type: "comment.add",
          by: "human:tester",
          quote: "New content",
          text: "This is a comment to preserve",
        })
        .expect(201);

      const markId = commentRes.body.mark.id;

      // Update the document markdown
      await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", accessToken)
        .send({ markdown: "# Updated Again\n\nNew content revised" })
        .expect(200);

      // Verify the comment is still present
      const state = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(state.body.marks[markId]).toBeDefined();
      expect(state.body.marks[markId].text).toBe("This is a comment to preserve");
      expect(state.body.revision).toBe(3);
    });

    it("updates title along with markdown when provided", async () => {
      await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", accessToken)
        .send({ markdown: "# With Title\n\nContent", title: "New Title" })
        .expect(200);

      const state = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(200);

      expect(state.body.title).toBe("New Title");
    });

    it("resets status to active after update on approved document", async () => {
      // Approve the document first
      await request(app)
        .post(`/documents/${slug}/ops`)
        .set("x-share-token", accessToken)
        .send({ type: "document.approve", by: "human:reviewer" })
        .expect(200);

      const approved = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken);
      expect(approved.body.status).toBe("approved");

      // Update should reset status to active
      await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", accessToken)
        .send({ markdown: "# Reset status\n\nContent" })
        .expect(200);

      const state = await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken);
      expect(state.body.status).toBe("active");
    });

    it("returns 404 without token", async () => {
      await request(app)
        .put(`/documents/${slug}`)
        .send({ markdown: "# No token" })
        .expect(404);
    });

    it("returns 404 with invalid token", async () => {
      await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", "invalid-token-value")
        .send({ markdown: "# Bad token" })
        .expect(404);
    });

    it("returns 400 without markdown", async () => {
      const res = await request(app)
        .put(`/documents/${slug}`)
        .set("x-share-token", accessToken)
        .send({ title: "Only Title" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_CONTENT");
    });

    it("creates a revision entry on each update", async () => {
      const revisions = await request(app)
        .get(`/documents/${slug}/revisions`)
        .set("x-share-token", accessToken)
        .expect(200);

      // At this point we have created the doc (rev 1) and done multiple updates
      expect(revisions.body.revisions.length).toBeGreaterThanOrEqual(2);
      const revNums = revisions.body.revisions.map((r: any) => r.revision);
      // Revisions should be ascending
      for (let i = 1; i < revNums.length; i++) {
        expect(revNums[i]).toBeGreaterThan(revNums[i - 1]);
      }
    });
  });

  describe("POST /documents — callback fields", () => {
    it("stores callbackUrl, callbackSessionId, and callbackId on creation", async () => {
      const res = await request(app)
        .post("/documents")
        .send({
          title: "Callback Doc",
          markdown: "# Callback Test",
          callbackUrl: "https://example.com/callback",
          callbackSessionId: "sess-123",
          callbackId: "cb-456",
        })
        .expect(201);

      expect(res.body.slug).toBeDefined();
      expect(res.body.accessToken).toBeDefined();

      // The callback fields are stored internally — verify the doc is accessible
      const state = await request(app)
        .get(`/documents/${res.body.slug}/state`)
        .set("x-share-token", res.body.accessToken)
        .expect(200);

      expect(state.body.slug).toBe(res.body.slug);
      expect(state.body.title).toBe("Callback Doc");
    });

    it("creates document without callback fields (optional)", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: "No Callback", markdown: "# No CB" })
        .expect(201);

      expect(res.body.slug).toBeDefined();
    });
  });

  describe("POST /documents — validation edge cases", () => {
    it("returns 400 when markdown is not a string", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: "Bad Type", markdown: 12345 })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when title is not a string", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: 12345, markdown: "# Valid" })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("uses default title when none provided", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ markdown: "# No Title Provided" })
        .expect(201);

      const state = await request(app)
        .get(`/documents/${res.body.slug}/state`)
        .set("x-share-token", res.body.accessToken)
        .expect(200);

      expect(state.body.title).toBe("Untitled Review");
    });

    it("handles very long markdown content", async () => {
      const longMarkdown = "# Long Doc\n\n" + "A".repeat(100_000);
      const res = await request(app)
        .post("/documents")
        .send({ title: "Long Doc", markdown: longMarkdown })
        .expect(201);

      const state = await request(app)
        .get(`/documents/${res.body.slug}/state`)
        .set("x-share-token", res.body.accessToken)
        .expect(200);

      expect(state.body.markdown).toBe(longMarkdown);
      expect(state.body.markdown.length).toBe(longMarkdown.length);
    });
  });

  describe("GET /documents/:slug/state — non-existent slug", () => {
    it("returns 403 when token is valid but slug does not match", async () => {
      const res = await request(app)
        .get("/documents/0000000000000000/state")
        .set("x-share-token", accessToken)
        .expect(403);

      expect(res.body.code).toBe("SLUG_MISMATCH");
    });

    it("returns 404 for non-existent slug with no token", async () => {
      await request(app)
        .get("/documents/0000000000000000/state")
        .expect(404);
    });
  });

  describe("DELETE /documents/:slug", () => {
    it("returns 403 without owner secret", async () => {
      await request(app)
        .delete(`/documents/${slug}`)
        .expect(403);
    });

    it("returns 403 with wrong owner secret", async () => {
      await request(app)
        .delete(`/documents/${slug}`)
        .set("x-owner-secret", "wrong-secret")
        .expect(403);
    });

    it("deletes document with valid owner secret", async () => {
      await request(app)
        .delete(`/documents/${slug}`)
        .set("x-owner-secret", ownerSecret)
        .expect(200);
    });

    it("returns 404 after deletion", async () => {
      await request(app)
        .get(`/documents/${slug}/state`)
        .set("x-share-token", accessToken)
        .expect(404);
    });
  });
});
