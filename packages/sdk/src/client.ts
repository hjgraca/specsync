import type {
  CreateDocumentResponse,
  DocumentState,
  StructuredQuestion,
  QASession,
  DocumentEvent,
} from "./types.js";

export class ReviewToolClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.REVIEW_TOOL_URL || "http://localhost:4000";
  }

  /**
   * Auth headers for document requests: the share token plus the join code
   * (the required second factor). `code` is optional so callers targeting
   * documents created before join codes existed keep working.
   */
  private docHeaders(token: string, code?: string, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { "x-share-token": token, ...extra };
    if (code) headers["x-join-code"] = code;
    return headers;
  }

  async createDocument(title: string, markdown: string): Promise<CreateDocumentResponse> {
    const res = await fetch(`${this.baseUrl}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, markdown }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to create document: ${err.error || res.statusText}`);
    }

    return res.json();
  }

  async updateDocument(slug: string, token: string, markdown: string, title?: string, code?: string): Promise<void> {
    const body: Record<string, string> = { markdown };
    if (title) body.title = title;

    const res = await fetch(`${this.baseUrl}/documents/${slug}`, {
      method: "PUT",
      headers: this.docHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to update document: ${err.error || res.statusText}`);
    }
  }

  async getDocumentState(slug: string, token: string, code?: string): Promise<DocumentState> {
    const res = await fetch(`${this.baseUrl}/documents/${slug}/state`, {
      headers: this.docHeaders(token, code),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to get document state: ${err.error || res.statusText}`);
    }

    return res.json();
  }

  async postOp(slug: string, token: string, op: Record<string, unknown>, code?: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/documents/${slug}/ops`, {
      method: "POST",
      headers: this.docHeaders(token, code, { "Content-Type": "application/json" }),
      body: JSON.stringify(op),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Operation failed: ${err.error || res.statusText}`);
    }

    return res.json();
  }

  async pollEvents(
    slug: string,
    token: string,
    since: number = 0,
    excludeBy?: string,
    code?: string,
  ): Promise<DocumentEvent[]> {
    let url = `${this.baseUrl}/documents/${slug}/events/pending?since=${since}`;
    if (excludeBy) {
      url += `&exclude_by=${encodeURIComponent(excludeBy)}`;
    }

    const res = await fetch(url, {
      headers: this.docHeaders(token, code),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to poll events: ${err.error || res.statusText}`);
    }

    const body = await res.json();
    return body.events;
  }

  async createQASession(title: string, questions: StructuredQuestion[]): Promise<QASession> {
    const res = await fetch(`${this.baseUrl}/qa/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, questions }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to create QA session: ${err.error || res.statusText}`);
    }

    return res.json();
  }

  async addQuestions(sessionId: string, questions: StructuredQuestion[], token?: string): Promise<void> {
    const url = token
      ? `${this.baseUrl}/qa/sessions/${sessionId}/questions?token=${token}`
      : `${this.baseUrl}/qa/sessions/${sessionId}/questions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to add questions: ${err.error || res.statusText}`);
    }
  }

  async getQASession(sessionId: string, token?: string): Promise<QASession> {
    const url = token
      ? `${this.baseUrl}/qa/sessions/${sessionId}?token=${token}`
      : `${this.baseUrl}/qa/sessions/${sessionId}`;
    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to get QA session: ${err.error || res.statusText}`);
    }

    return res.json();
  }
}
