import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

const app = createApp();

describe("Q&A session routes", () => {
  let sessionId: string;
  let sessionToken: string;

  const questions = [
    {
      id: "q1",
      title: "Rate limiting scope",
      options: [
        { key: "a", label: "Per API key", recommended: true },
        { key: "b", label: "Per user" },
      ],
      default: "a",
      type: "single-select" as const,
    },
    {
      id: "q2",
      title: "Storage backend",
      options: [
        { key: "a", label: "Redis" },
        { key: "b", label: "In-memory" },
      ],
      type: "single-select" as const,
    },
  ];

  describe("POST /qa/sessions", () => {
    it("creates a session with questions", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Test Q&A", questions })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.title).toBe("Test Q&A");
      expect(res.body.questions).toHaveLength(2);
      expect(res.body.answers).toEqual({});
      expect(res.body.status).toBe("active");
      sessionId = res.body.id;
      sessionToken = res.body.token;
    });

    it("returns 400 without questions", async () => {
      await request(app)
        .post("/qa/sessions")
        .send({ title: "Empty" })
        .expect(400);
    });
  });

  describe("GET /qa/sessions/:id", () => {
    it("returns session state", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${sessionId}?token=${sessionToken}`)
        .expect(200);

      expect(res.body.id).toBe(sessionId);
      expect(res.body.questions).toHaveLength(2);
    });

    it("returns 401 without token", async () => {
      await request(app).get(`/qa/sessions/${sessionId}`).expect(401);
    });
  });

  describe("POST /qa/sessions/:id/answer", () => {
    it("submits an answer for a question", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${sessionId}/answer?token=${sessionToken}`)
        .send({ questionId: "q1", answer: "a" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.allAnswered).toBe(false);
    });

    it("marks session complete when all answered", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${sessionId}/answer?token=${sessionToken}`)
        .send({ questionId: "q2", answer: "b" })
        .expect(200);

      expect(res.body.allAnswered).toBe(true);
      expect(res.body.status).toBe("completed");
    });

    it("session state reflects completion", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${sessionId}?token=${sessionToken}`)
        .expect(200);

      expect(res.body.status).toBe("completed");
      expect(res.body.answers).toEqual({ q1: "a", q2: "b" });
    });

    it("returns 400 without required fields", async () => {
      await request(app)
        .post(`/qa/sessions/${sessionId}/answer?token=${sessionToken}`)
        .send({ questionId: "q1" })
        .expect(400);
    });
  });

  describe("POST /qa/sessions/:id/discuss", () => {
    let newSessionId: string;
    let newToken: string;

    it("adds discussion message to a question", async () => {
      const create = await request(app)
        .post("/qa/sessions")
        .send({ title: "Discussion Test", questions });
      newSessionId = create.body.id;
      newToken = create.body.token;

      const res = await request(app)
        .post(`/qa/sessions/${newSessionId}/discuss?token=${newToken}`)
        .send({ questionId: "q1", by: "human:alice", text: "I think option A is better" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message.by).toBe("human:alice");
    });

    it("discussion appears in session state", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${newSessionId}?token=${newToken}`)
        .expect(200);

      expect(res.body.discussions.q1).toHaveLength(1);
      expect(res.body.discussions.q1[0].text).toBe("I think option A is better");
    });
  });
});
