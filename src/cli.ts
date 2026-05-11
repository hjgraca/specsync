#!/usr/bin/env node

import { createServer } from "http";
import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { createApp } from "./server/app.js";
import { getDb, purgeExpired, closeDb } from "./server/db.js";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "start") {
  startServer();
} else if (command === "create") {
  createDocument(args.slice(1));
} else if (command === "install") {
  const { install } = await import("./installer.js");
  install(args.slice(1));
} else if (command === "attach-agent") {
  attachAgent(args.slice(1));
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Usage:");
  console.error("  specsync start [--port 4000] [--host 0.0.0.0]");
  console.error("  specsync create <file.md> [--title 'Title']");
  console.error("  specsync install --to <target>  (agents|claude|kiro|cursor|all)");
  console.error("  specsync attach-agent --slug <slug> --token <token> --name <name>");
  process.exit(1);
}

function startServer() {
  const port = parseInt(getArg("--port") || process.env.PORT || "4000", 10);
  const host = getArg("--host") || process.env.HOST || "0.0.0.0";

  const dbDir = process.env.REVIEW_TOOL_DB_PATH
    ? path.dirname(process.env.REVIEW_TOOL_DB_PATH)
    : process.cwd();
  mkdirSync(dbDir, { recursive: true });

  getDb();
  const purged = purgeExpired();
  if (purged > 0) {
    console.log(`Purged ${purged} expired documents`);
  }

  const app = createApp();
  const server = createServer(app);

  server.listen(port, host, () => {
    console.log(`\n  Specsync`);
    console.log(`  Server running at http://${host}:${port}\n`);
    console.log(`  Q&A UI:     http://${host}:${port}/qa/<session-id>`);
    console.log(`  Review UI:  http://${host}:${port}/review/<slug>?token=<token>`);
    console.log(`  Health:     http://${host}:${port}/health\n`);
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    closeDb();
    server.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    closeDb();
    server.close();
    process.exit(0);
  });
}

async function createDocument(args: string[]) {
  const filePath = args[0];
  if (!filePath) {
    console.error("Usage: specsync create <file.md> [--title 'Title']");
    process.exit(1);
  }

  const title = getArgFrom(args, "--title") || path.basename(filePath, ".md");

  let markdown: string;
  try {
    markdown = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const port = process.env.PORT || "4000";
  const host = process.env.HOST || "localhost";
  const baseUrl = `http://${host}:${port}`;

  try {
    const res = await fetch(`${baseUrl}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, markdown }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error(`Failed to create document: ${err.error}`);
      process.exit(1);
    }

    const doc = await res.json();
    console.log(`\n  Document created!`);
    console.log(`  Review URL:  ${doc.docUrl}`);
    console.log(`  Bridge URL:  ${doc.bridgeUrl}`);
    console.log(`  Slug:        ${doc.slug}`);
    console.log(`  Token:       ${doc.accessToken}\n`);
  } catch {
    console.error(`Cannot connect to server at ${baseUrl}. Is it running?`);
    process.exit(1);
  }
}

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function getArgFrom(argList: string[], name: string): string | undefined {
  const idx = argList.indexOf(name);
  if (idx !== -1 && idx + 1 < argList.length) {
    return argList[idx + 1];
  }
  return undefined;
}

async function attachAgent(args: string[]) {
  const slug = getArgFrom(args, "--slug");
  const token = getArgFrom(args, "--token");
  const { generateCodename } = await import("./shared/codenames.js");
  const name = getArgFrom(args, "--name") || `cli-${generateCodename()}`;
  const pollInterval = parseInt(getArgFrom(args, "--poll") || "5000", 10);

  if (!slug || !token) {
    console.error("Usage: specsync attach-agent --slug <slug> --token <token> [--name <name>] [--poll <ms>]");
    console.error("");
    console.error("Connects to a review document and prints events in real-time.");
    console.error("Use the bridge URL and token from the review UI (Copy Bridge URL button).");
    process.exit(1);
  }

  const baseUrl = process.env.REVIEW_TOOL_URL || "http://localhost:4000";
  const agentId = `ai:${name}`;

  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    if (!healthRes.ok) throw new Error("not ok");
  } catch {
    console.error(`Cannot connect to server at ${baseUrl}. Is it running?`);
    process.exit(1);
  }

  await fetch(`${baseUrl}/documents/${slug}/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: agentId, name, role: "commenter" }),
  });

  console.log(`\n  Specsync Agent Bridge`);
  console.log(`  Connected as: ${agentId}`);
  console.log(`  Document: ${baseUrl}/documents/${slug}`);
  console.log(`  Polling every ${pollInterval}ms`);
  console.log(`  Press Ctrl+C to disconnect\n`);
  console.log(`  Waiting for events...\n`);

  let lastEventId = 0;

  const poll = async () => {
    try {
      const res = await fetch(
        `${baseUrl}/documents/${slug}/events/pending?since=${lastEventId}&exclude_by=${encodeURIComponent(agentId)}`,
        { headers: { "x-share-token": token } },
      );

      if (!res.ok) {
        console.error(`  Poll error: ${res.status} ${res.statusText}`);
        return;
      }

      const { events } = await res.json() as { events: Array<{ id: number; type: string; actor: string; data: Record<string, unknown> }> };

      for (const event of events) {
        lastEventId = event.id;
        const data = event.data;

        switch (event.type) {
          case "comment.added":
            console.log(`  💬 [${event.actor}] commented on "${(data.quote as string || "").slice(0, 50)}"`);
            console.log(`     "${data.text}"`);
            console.log("");
            break;
          case "comment.replied":
            console.log(`  ↩️  [${event.actor}] replied: "${data.text}"`);
            console.log("");
            break;
          case "suggestion.added":
            console.log(`  💡 [${event.actor}] suggested: replace "${(data.quote as string || "").slice(0, 40)}" with "${(data.content as string || "").slice(0, 40)}"`);
            console.log("");
            break;
          case "comment.resolved":
            console.log(`  ✓  [${event.actor}] resolved a thread`);
            console.log("");
            break;
          case "document.approved":
            console.log(`  ✅ APPROVED by ${event.actor}`);
            console.log("");
            break;
          case "document.changes_requested":
            console.log(`  ❌ CHANGES REQUESTED by ${event.actor}`);
            console.log("");
            break;
          case "document.revised":
            console.log(`  📝 Document revised (new revision: ${data.revision})`);
            console.log("");
            break;
          default:
            console.log(`  [${event.type}] by ${event.actor}`);
            console.log("");
        }
      }
    } catch (err) {
      console.error(`  Connection error: ${(err as Error).message}`);
    }
  };

  const interval = setInterval(poll, pollInterval);

  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n  Disconnected.\n");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(interval);
    process.exit(0);
  });

  await poll();
}
