#!/usr/bin/env node

import { createServer } from "http";
import { mkdirSync } from "fs";
import path from "path";
import { createApp } from "./server/app.js";
import { getDb, purgeExpired, closeDb } from "./server/db.js";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

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
