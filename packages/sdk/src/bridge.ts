import { ReviewToolClient } from "./client.js";
import type { ApprovalResult, DocumentEvent, Mark } from "./types.js";

export interface BridgeOptions {
  slug: string;
  accessToken: string;
  /** The document's join code (second factor). Required for documents created with one. */
  joinCode?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sinceEventId?: number;
  onComment?: (comment: { markId: string; by: string; quote: string; text: string }) => Promise<string | null>;
}

export async function participateInReview(options: BridgeOptions): Promise<ApprovalResult> {
  const {
    slug,
    accessToken,
    joinCode,
    baseUrl,
    pollIntervalMs = parseInt(process.env.REVIEW_TOOL_POLL_INTERVAL || "5000", 10),
    timeoutMs = 48 * 60 * 60 * 1000,
    sinceEventId,
    onComment,
  } = options;

  const client = new ReviewToolClient(baseUrl);
  let lastEventId = sinceEventId || 0;
  const startTime = Date.now();
  const repliedMarks = new Set<string>();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Review timed out after ${timeoutMs}ms`);
    }

    const events = await client.pollEvents(slug, accessToken, lastEventId, "ai:*", joinCode);

    for (const event of events) {
      lastEventId = event.id;

      if (event.type === "document.approved") {
        const state = await client.getDocumentState(slug, accessToken, joinCode);
        const unresolvedComments = collectUnresolvedHumanComments(state.marks);
        return {
          status: "approved",
          changesSummary: buildSummary(state.marks, unresolvedComments),
          approvedBy: event.actor,
          comments: unresolvedComments.length > 0 ? unresolvedComments : undefined,
        };
      }

      if (event.type === "document.changes_requested") {
        const state = await client.getDocumentState(slug, accessToken, joinCode);
        const allComments = collectAllHumanComments(state.marks);
        return {
          status: "changes_requested",
          comments: allComments,
        };
      }

      if (event.type === "comment.added" && onComment) {
        const data = event.data as { markId: string; by: string; quote: string; text: string };
        if (data.by.startsWith("human:") && !repliedMarks.has(data.markId)) {
          const reply = await onComment(data);
          if (reply) {
            await client.postOp(slug, accessToken, {
              type: "comment.reply",
              markId: data.markId,
              by: "ai:agent",
              text: reply,
            }, joinCode);
            repliedMarks.add(data.markId);
          }
        }
      }

      if (event.type === "comment.replied" && onComment) {
        const data = event.data as { markId: string; by: string; text: string };
        if (data.by.startsWith("human:") && !repliedMarks.has(`${data.markId}-reply-${event.id}`)) {
          const state = await client.getDocumentState(slug, accessToken, joinCode);
          const mark = state.marks[data.markId];
          if (mark) {
            const reply = await onComment({
              markId: data.markId,
              by: data.by,
              quote: mark.quote,
              text: data.text,
            });
            if (reply) {
              await client.postOp(slug, accessToken, {
                type: "comment.reply",
                markId: data.markId,
                by: "ai:agent",
                text: reply,
              }, joinCode);
              repliedMarks.add(`${data.markId}-reply-${event.id}`);
            }
          }
        }
      }
    }

    await sleep(pollIntervalMs);
  }
}

function collectUnresolvedHumanComments(
  marks: Record<string, Mark>,
): { section: string; comment: string }[] {
  return Object.values(marks)
    .filter((m) => !m.resolved && m.by.startsWith("human:"))
    .map((m) => ({
      section: m.quote.slice(0, 80),
      comment: m.text || m.content || "",
    }));
}

function collectAllHumanComments(
  marks: Record<string, Mark>,
): { section: string; comment: string }[] {
  return Object.values(marks)
    .filter((m) => m.by.startsWith("human:"))
    .map((m) => ({
      section: m.quote.slice(0, 80),
      comment: m.text || m.content || "",
    }));
}

function buildSummary(
  marks: Record<string, Mark>,
  unresolvedComments: { section: string; comment: string }[],
): string {
  const total = Object.values(marks).length;
  const resolved = Object.values(marks).filter((m) => m.resolved).length;
  const suggestions = Object.values(marks).filter((m) => m.type === "suggestion").length;

  const parts: string[] = [];
  if (total > 0) parts.push(`${total} mark(s) total`);
  if (resolved > 0) parts.push(`${resolved} resolved`);
  if (suggestions > 0) parts.push(`${suggestions} suggestion(s)`);
  if (unresolvedComments.length > 0) {
    parts.push(`${unresolvedComments.length} unresolved comment(s) to address`);
  }

  return parts.join(", ") || "No activity during review";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
