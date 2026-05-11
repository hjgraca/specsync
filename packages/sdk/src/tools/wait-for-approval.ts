import { writeFileSync } from "fs";
import type { ApprovalResult } from "../types.js";
import { participateInReview, type BridgeOptions } from "../bridge.js";
import { ReviewToolClient } from "../client.js";

export interface WaitForApprovalParams {
  slug: string;
  accessToken: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sinceEventId?: number;
  onComment?: BridgeOptions["onComment"];
  syncToFile?: string;
}

export async function waitForApproval(
  params: WaitForApprovalParams,
): Promise<ApprovalResult> {
  const result = await participateInReview({
    slug: params.slug,
    accessToken: params.accessToken,
    baseUrl: params.baseUrl,
    pollIntervalMs: params.pollIntervalMs,
    timeoutMs: params.timeoutMs,
    sinceEventId: params.sinceEventId,
    onComment: params.onComment,
  });

  if (result.status === "approved" && params.syncToFile) {
    const client = new ReviewToolClient(params.baseUrl);
    const state = await client.getDocumentState(params.slug, params.accessToken);
    writeFileSync(params.syncToFile, state.markdown, "utf-8");
  }

  return result;
}
