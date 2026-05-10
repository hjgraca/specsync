import { createServer, type Server } from "http";
import { mkdirSync } from "fs";
import path from "path";
import { getDb, purgeExpired, closeDb } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();
const server: Server = createServer(app);

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const dbDir = process.env.REVIEW_TOOL_DB_PATH
  ? path.dirname(process.env.REVIEW_TOOL_DB_PATH)
  : path.join(process.cwd(), ".harness");
mkdirSync(dbDir, { recursive: true });

getDb();
const purged = purgeExpired();
if (purged > 0) {
  console.log(`Purged ${purged} expired documents`);
}

server.listen(PORT, HOST, () => {
  console.log(`Review tool server running at http://${HOST}:${PORT}`);
});

process.on("SIGINT", () => {
  closeDb();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  server.close();
  process.exit(0);
});

export { app, server };
