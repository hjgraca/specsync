import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

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

      expect(res.body.slug).toHaveLength(8);
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
