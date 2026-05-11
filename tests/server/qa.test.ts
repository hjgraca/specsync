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

  describe("free-text questions", () => {
    let ftSessionId: string;
    let ftToken: string;

    const freeTextQuestions = [
      {
        id: "ft1",
        title: "Describe your preferred architecture",
        type: "free-text" as const,
        options: [],
      },
    ];

    it("creates a session with a free-text question", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Free Text Q&A", questions: freeTextQuestions })
        .expect(201);

      ftSessionId = res.body.id;
      ftToken = res.body.token;
    });

    it("can submit any text answer to a free-text question", async () => {
      const freeAnswer = "I prefer a microservices architecture with event-driven communication.";
      const res = await request(app)
        .post(`/qa/sessions/${ftSessionId}/answer?token=${ftToken}`)
        .send({ questionId: "ft1", answer: freeAnswer })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.answer).toBe(freeAnswer);
      expect(res.body.allAnswered).toBe(true);
      expect(res.body.status).toBe("completed");
    });

    it("persists the free-text answer in session state", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${ftSessionId}?token=${ftToken}`)
        .expect(200);

      expect(res.body.answers.ft1).toBe(
        "I prefer a microservices architecture with event-driven communication.",
      );
    });
  });

  describe("answer edge cases", () => {
    let ecSessionId: string;
    let ecToken: string;

    const ecQuestions = [
      {
        id: "ec1",
        title: "Edge case question 1",
        options: [
          { key: "a", label: "Option A" },
          { key: "b", label: "Option B" },
        ],
        type: "single-select" as const,
      },
      {
        id: "ec2",
        title: "Edge case question 2",
        options: [
          { key: "a", label: "Option A" },
          { key: "b", label: "Option B" },
        ],
        type: "single-select" as const,
      },
    ];

    it("creates a session for edge case tests", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Edge Cases", questions: ecQuestions })
        .expect(201);

      ecSessionId = res.body.id;
      ecToken = res.body.token;
    });

    it("returns 400 when submitting answer with invalid questionId", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${ecSessionId}/answer?token=${ecToken}`)
        .send({ questionId: "nonexistent", answer: "a" })
        .expect(400);

      expect(res.body.code).toBe("INVALID_QUESTION");
    });

    it("submitting duplicate answer (same questionId twice) updates the answer", async () => {
      await request(app)
        .post(`/qa/sessions/${ecSessionId}/answer?token=${ecToken}`)
        .send({ questionId: "ec1", answer: "a" })
        .expect(200);

      const res = await request(app)
        .post(`/qa/sessions/${ecSessionId}/answer?token=${ecToken}`)
        .send({ questionId: "ec1", answer: "b" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.answer).toBe("b");

      const state = await request(app)
        .get(`/qa/sessions/${ecSessionId}?token=${ecToken}`)
        .expect(200);

      expect(state.body.answers.ec1).toBe("b");
    });

    it("session with all questions answered returns status completed", async () => {
      // ec1 is already answered from the previous test
      const res = await request(app)
        .post(`/qa/sessions/${ecSessionId}/answer?token=${ecToken}`)
        .send({ questionId: "ec2", answer: "a" })
        .expect(200);

      expect(res.body.allAnswered).toBe(true);
      expect(res.body.status).toBe("completed");

      const state = await request(app)
        .get(`/qa/sessions/${ecSessionId}?token=${ecToken}`)
        .expect(200);

      expect(state.body.status).toBe("completed");
    });
  });

  describe("token validation edge cases", () => {
    let tvSessionId: string;

    it("creates a session for token tests", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Token Tests", questions })
        .expect(201);

      tvSessionId = res.body.id;
    });

    it("returns 401 when missing token on GET", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${tvSessionId}`)
        .expect(401);

      expect(res.body.code).toBe("NO_TOKEN");
    });

    it("returns 401 when missing token on answer", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${tvSessionId}/answer`)
        .send({ questionId: "q1", answer: "a" })
        .expect(401);

      expect(res.body.code).toBe("NO_TOKEN");
    });

    it("returns 401 with invalid token on GET", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${tvSessionId}?token=completely-wrong-token`)
        .expect(401);

      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("returns 401 with invalid token on answer", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${tvSessionId}/answer?token=completely-wrong-token`)
        .send({ questionId: "q1", answer: "a" })
        .expect(401);

      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("returns 401 when missing token on discuss", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${tvSessionId}/discuss`)
        .send({ questionId: "q1", by: "human:alice", text: "hello" })
        .expect(401);

      expect(res.body.code).toBe("NO_TOKEN");
    });

    it("returns 401 with invalid token on discuss", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${tvSessionId}/discuss?token=wrong`)
        .send({ questionId: "q1", by: "human:alice", text: "hello" })
        .expect(401);

      expect(res.body.code).toBe("INVALID_TOKEN");
    });
  });

  describe("discussion thread edge cases", () => {
    let dSessionId: string;
    let dToken: string;

    const dQuestions = [
      {
        id: "dq1",
        title: "Discussion question 1",
        options: [{ key: "a", label: "Yes" }],
        type: "single-select" as const,
      },
      {
        id: "dq2",
        title: "Discussion question 2",
        options: [{ key: "a", label: "Yes" }],
        type: "single-select" as const,
      },
    ];

    it("creates a session for discussion tests", async () => {
      const res = await request(app)
        .post("/qa/sessions")
        .send({ title: "Discussion Tests", questions: dQuestions })
        .expect(201);

      dSessionId = res.body.id;
      dToken = res.body.token;
    });

    it("adds a discussion message to a question", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq1", by: "agent:pm", text: "This needs clarification." })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message.by).toBe("agent:pm");
      expect(res.body.message.text).toBe("This needs clarification.");
      expect(res.body.message.createdAt).toBeDefined();
    });

    it("adds multiple discussion messages to the same question", async () => {
      await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq1", by: "human:bob", text: "I agree, let me elaborate." })
        .expect(200);

      await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq1", by: "agent:pm", text: "Thanks for the follow-up." })
        .expect(200);

      const res = await request(app)
        .get(`/qa/sessions/${dSessionId}?token=${dToken}`)
        .expect(200);

      expect(res.body.discussions.dq1).toHaveLength(3);
      expect(res.body.discussions.dq1[0].by).toBe("agent:pm");
      expect(res.body.discussions.dq1[1].by).toBe("human:bob");
      expect(res.body.discussions.dq1[2].by).toBe("agent:pm");
    });

    it("adds discussions to different questions independently", async () => {
      await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq2", by: "human:carol", text: "Question 2 discussion." })
        .expect(200);

      const res = await request(app)
        .get(`/qa/sessions/${dSessionId}?token=${dToken}`)
        .expect(200);

      expect(res.body.discussions.dq1).toHaveLength(3);
      expect(res.body.discussions.dq2).toHaveLength(1);
      expect(res.body.discussions.dq2[0].text).toBe("Question 2 discussion.");
    });

    it("returns 400 when discuss is missing questionId", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ by: "human:alice", text: "Missing qid" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 400 when discuss is missing by", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq1", text: "Missing by" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("returns 400 when discuss is missing text", async () => {
      const res = await request(app)
        .post(`/qa/sessions/${dSessionId}/discuss?token=${dToken}`)
        .send({ questionId: "dq1", by: "human:alice" })
        .expect(400);

      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("GET session returns discussions in response", async () => {
      const res = await request(app)
        .get(`/qa/sessions/${dSessionId}?token=${dToken}`)
        .expect(200);

      expect(res.body.discussions).toBeDefined();
      expect(typeof res.body.discussions).toBe("object");
      expect(res.body.discussions.dq1).toBeInstanceOf(Array);
      for (const msg of res.body.discussions.dq1) {
        expect(msg).toHaveProperty("by");
        expect(msg).toHaveProperty("text");
        expect(msg).toHaveProperty("createdAt");
      }
    });
  });
});
