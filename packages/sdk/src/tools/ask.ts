import type { StructuredQuestion } from "../types.js";
import { ReviewToolClient } from "../client.js";

export interface AskParams {
  questions: StructuredQuestion[];
  title?: string;
  baseUrl?: string;
  sessionId?: string;
  sessionToken?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface AskResult {
  answers: Record<string, string>;
  sessionId: string;
  sessionToken: string;
  sessionUrl: string;
}

export async function ask(params: AskParams): Promise<AskResult> {
  const {
    questions,
    title = "Agent Questions",
    baseUrl,
    sessionId,
    pollIntervalMs = 2000,
    timeoutMs = 48 * 60 * 60 * 1000,
  } = params;

  const client = new ReviewToolClient(baseUrl);

  let activeSessionId: string;
  let sessionToken: string;

  if (sessionId) {
    await client.addQuestions(sessionId, questions, params.sessionToken);
    activeSessionId = sessionId;
    sessionToken = params.sessionToken || "";
  } else {
    const session = await client.createQASession(title, questions);
    activeSessionId = session.id;
    sessionToken = (session as unknown as { token?: string }).token || "";
  }

  const serverUrl = baseUrl || process.env.REVIEW_TOOL_URL || "http://localhost:4000";
  const sessionUrl = `${serverUrl}/qa/${activeSessionId}?token=${sessionToken}`;
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Q&A session timed out after ${timeoutMs}ms without all answers`);
    }

    const current = await client.getQASession(activeSessionId, sessionToken);
    const allAnswered = questions.every((q) => current.answers[q.id] !== undefined);

    if (allAnswered || current.status === "completed") {
      return { answers: current.answers, sessionId: activeSessionId, sessionToken, sessionUrl };
    }

    await sleep(pollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
