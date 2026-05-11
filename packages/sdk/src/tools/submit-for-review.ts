import { readFileSync } from "fs";
import { basename } from "path";
import { ReviewToolClient } from "../client.js";

export interface SubmitForReviewParams {
  title: string;
  files: string[];
  baseUrl?: string;
  slug?: string;
  accessToken?: string;
}

export interface SubmitForReviewResult {
  docUrl: string;
  bridgeUrl: string;
  slug: string;
  accessToken: string;
  lastEventId: number;
}

export async function submitForReview(
  params: SubmitForReviewParams,
): Promise<SubmitForReviewResult> {
  const { title, files, baseUrl, slug, accessToken } = params;

  if (!files || files.length === 0) {
    throw new Error("At least one file path is required");
  }

  const sections: string[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      throw new Error(`Cannot read file: ${filePath} — ${(err as Error).message}`);
    }

    if (files.length > 1) {
      sections.push(`<!-- file: ${basename(filePath)} -->\n\n${content}`);
    } else {
      sections.push(content);
    }
  }

  const markdown = sections.join("\n\n---\n\n");

  const client = new ReviewToolClient(baseUrl);
  const serverUrl = baseUrl || process.env.REVIEW_TOOL_URL || "http://localhost:4000";

  if (slug && accessToken) {
    await client.updateDocument(slug, accessToken, markdown, title);
    const events = await client.pollEvents(slug, accessToken, 0);
    const lastEventId = events.length > 0 ? events[events.length - 1].id : 0;
    const docUrl = `${serverUrl}/review/${slug}?token=${accessToken}`;
    return { docUrl, bridgeUrl: `${serverUrl}/documents/${slug}`, slug, accessToken, lastEventId };
  }

  const doc = await client.createDocument(title, markdown);

  return {
    docUrl: doc.docUrl,
    bridgeUrl: doc.bridgeUrl,
    slug: doc.slug,
    accessToken: doc.accessToken,
    lastEventId: 0,
  };
}
