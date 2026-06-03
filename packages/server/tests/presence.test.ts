import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app.js";

const app = createApp();

describe("presence routes", () => {
  describe("document presence", () => {
    let slug: string;
    let accessToken: string;
    let joinCode: string;

    it("creates a document for presence tests", async () => {
      const res = await request(app)
        .post("/documents")
        .send({ title: "Presence Doc", markdown: "# Presence Test" })
        .expect(201);

      slug = res.body.slug;
      accessToken = res.body.accessToken;
      joinCode = res.body.joinCode;
    });

    describe("POST /documents/:slug/presence", () => {
      it("registers presence with id, name, and role", async () => {
        const res = await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ id: "user-1", name: "Alice", role: "editor" })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.entry.id).toBe("user-1");
        expect(res.body.entry.name).toBe("Alice");
        expect(res.body.entry.role).toBe("editor");
        expect(res.body.entry.connectedAt).toBeDefined();
      });

      it("defaults role to viewer when not provided", async () => {
        const res = await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ id: "user-2", name: "Bob" })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.entry.role).toBe("viewer");
      });

      it("returns 400 without id", async () => {
        const res = await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ name: "NoId" })
          .expect(400);

        expect(res.body.code).toBe("MISSING_FIELDS");
      });

      it("returns 400 without name", async () => {
        const res = await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ id: "user-3" })
          .expect(400);

        expect(res.body.code).toBe("MISSING_FIELDS");
      });

      it("returns 404 without auth token", async () => {
        await request(app)
          .post(`/documents/${slug}/presence`)
          .send({ id: "user-4", name: "Unauthed" })
          .expect(404);
      });

      it("returns 404 with invalid auth token", async () => {
        await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", "invalid-token")
          .send({ id: "user-5", name: "BadToken" })
          .expect(404);
      });

      it("includes optional status field", async () => {
        const res = await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ id: "user-6", name: "StatusUser", role: "commenter", status: "typing" })
          .expect(200);

        expect(res.body.entry.status).toBe("typing");
      });
    });

    describe("GET /documents/:slug/presence", () => {
      it("returns registered presence entries", async () => {
        const res = await request(app)
          .get(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .expect(200);

        expect(res.body.presence).toBeInstanceOf(Array);
        expect(res.body.presence.length).toBeGreaterThanOrEqual(2);

        const alice = res.body.presence.find((p: any) => p.id === "user-1");
        expect(alice).toBeDefined();
        expect(alice.name).toBe("Alice");
        expect(alice.role).toBe("editor");
      });

      it("shows multiple participants", async () => {
        const res = await request(app)
          .get(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .expect(200);

        const ids = res.body.presence.map((p: any) => p.id);
        expect(ids).toContain("user-1");
        expect(ids).toContain("user-2");
      });

      it("returns 404 without auth token", async () => {
        await request(app)
          .get(`/documents/${slug}/presence`)
          .expect(404);
      });

      it("returns 404 with mismatched slug", async () => {
        // Create a second document to get a token for a different slug
        const other = await request(app)
          .post("/documents")
          .send({ title: "Other Doc", markdown: "# Other" })
          .expect(201);

        // Use the other document's token to access the first document's presence
        await request(app)
          .get(`/documents/${slug}/presence`)
          .set("x-share-token", other.body.accessToken)
          .set("x-join-code", other.body.joinCode)
          .expect(404);
      });
    });

    describe("presence updates (re-register same id)", () => {
      it("overwrites presence for the same id", async () => {
        await request(app)
          .post(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .send({ id: "user-1", name: "Alice Updated", role: "owner" })
          .expect(200);

        const res = await request(app)
          .get(`/documents/${slug}/presence`)
          .set("x-share-token", accessToken)
          .set("x-join-code", joinCode)
          .expect(200);

        const alice = res.body.presence.find((p: any) => p.id === "user-1");
        expect(alice.name).toBe("Alice Updated");
        expect(alice.role).toBe("owner");
      });
    });
  });

  describe("QA session presence", () => {
    let sessionId: string;
    let sessionToken: string;

    const questions = [
      {
        id: "pq1",
        title: "Presence test question",
        options: [{ key: "a", label: "Option A" }],
        type: "single-select" as const,
      },
    ];

    it("creates a QA session for presence tests", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Presence QA", questions })
        .expect(201);

      sessionId = res.body.id;
      sessionToken = res.body.token;
    });

    describe("POST /qa/sessions/:sessionId/presence", () => {
      it("registers presence with id, name, and role", async () => {
        const res = await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .send({ id: "qa-user-1", name: "Charlie", role: "editor" })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.entry.id).toBe("qa-user-1");
        expect(res.body.entry.name).toBe("Charlie");
        expect(res.body.entry.role).toBe("editor");
        expect(res.body.entry.connectedAt).toBeDefined();
      });

      it("defaults role to viewer when not provided", async () => {
        const res = await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .send({ id: "qa-user-2", name: "Diana" })
          .expect(200);

        expect(res.body.entry.role).toBe("viewer");
      });

      it("returns 400 without id", async () => {
        const res = await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .send({ name: "NoId" })
          .expect(400);

        expect(res.body.code).toBe("MISSING_FIELDS");
      });

      it("returns 400 without name", async () => {
        const res = await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .send({ id: "qa-user-3" })
          .expect(400);

        expect(res.body.code).toBe("MISSING_FIELDS");
      });

      it("returns 404 without token", async () => {
        await request(app)
          .post(`/qa/sessions/${sessionId}/presence`)
          .send({ id: "qa-user-4", name: "Unauthed" })
          .expect(404);
      });

      it("returns 404 with invalid token", async () => {
        await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=bad-token`)
          .send({ id: "qa-user-5", name: "BadToken" })
          .expect(404);
      });

      it("accepts token via x-share-token header", async () => {
        const res = await request(app)
          .post(`/qa/sessions/${sessionId}/presence`)
          .set("x-share-token", sessionToken)
          .send({ id: "qa-user-header", name: "HeaderAuth" })
          .expect(200);

        expect(res.body.success).toBe(true);
      });
    });

    describe("GET /qa/sessions/:sessionId/presence", () => {
      it("returns registered presence entries", async () => {
        const res = await request(app)
          .get(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .expect(200);

        expect(res.body.presence).toBeInstanceOf(Array);
        expect(res.body.presence.length).toBeGreaterThanOrEqual(2);

        const charlie = res.body.presence.find((p: any) => p.id === "qa-user-1");
        expect(charlie).toBeDefined();
        expect(charlie.name).toBe("Charlie");
      });

      it("shows multiple participants", async () => {
        const res = await request(app)
          .get(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .expect(200);

        const ids = res.body.presence.map((p: any) => p.id);
        expect(ids).toContain("qa-user-1");
        expect(ids).toContain("qa-user-2");
      });

      it("returns 404 without token", async () => {
        await request(app)
          .get(`/qa/sessions/${sessionId}/presence`)
          .expect(404);
      });

      it("returns 404 with invalid token", async () => {
        await request(app)
          .get(`/qa/sessions/${sessionId}/presence?token=wrong-token`)
          .expect(404);
      });
    });

    describe("presence updates (re-register same id)", () => {
      it("overwrites presence for the same id", async () => {
        await request(app)
          .post(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .send({ id: "qa-user-1", name: "Charlie Updated", role: "owner" })
          .expect(200);

        const res = await request(app)
          .get(`/qa/sessions/${sessionId}/presence?token=${sessionToken}`)
          .expect(200);

        const charlie = res.body.presence.find((p: any) => p.id === "qa-user-1");
        expect(charlie.name).toBe("Charlie Updated");
        expect(charlie.role).toBe("owner");
      });
    });
  });
});
