import express, { type Express, type Request, type Response, type NextFunction } from "express";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import documentRoutes from "./routes/documents.js";
import opsRoutes from "./routes/ops.js";
import eventsRoutes from "./routes/events.js";
import qaRoutes from "./routes/qa.js";
import presenceRoutes from "./routes/presence.js";

export function createApp(): Express {
  const app = express();

  const bodyLimit = process.env.SPECSYNC_MAX_BODY_SIZE || "5mb";
  app.use(express.json({ limit: bodyLimit }));

  const corsOrigin = process.env.CORS_ORIGIN || null;

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;",
    );

    if (corsOrigin) {
      const origin = req.headers.origin;
      const allowed = corsOrigin === "*" || (origin && corsOrigin.split(",").includes(origin));
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin || corsOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-share-token, x-owner-secret");
      }
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
    }

    next();
  });

  morgan.token("clean-url", (req: Request) => {
    const url = req.originalUrl || req.url;
    return url.replace(/([?&])token=[^&]*/g, "$1token=REDACTED");
  });
  app.use(morgan(":method :clean-url :status :response-time ms"));

  const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests", code: "RATE_LIMITED" },
  });

  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests", code: "RATE_LIMITED" },
  });

  app.use("/documents", readLimiter);
  app.use("/qa", readLimiter);
  app.post("/documents", createLimiter);
  app.post("/qa/sessions", createLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(documentRoutes);
  app.use(opsRoutes);
  app.use(eventsRoutes);
  app.use(qaRoutes);
  app.use(presenceRoutes);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(__dirname, "../client");

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }

  const qaHtmlCandidates = ["qa/index.html", "src/client/qa/index.html"];
  const reviewHtmlCandidates = ["review/index.html", "src/client/review/index.html"];

  app.get("/qa/:sessionId", (_req, res) => {
    const match = qaHtmlCandidates.find((p) => existsSync(resolve(clientDist, p)));
    if (match) {
      res.sendFile(match, { root: clientDist });
    } else {
      res.status(200).send("<!-- Q&A UI: run 'pnpm build' to serve the client -->");
    }
  });

  app.get("/review/:slug", (_req, res) => {
    const match = reviewHtmlCandidates.find((p) => existsSync(resolve(clientDist, p)));
    if (match) {
      res.sendFile(match, { root: clientDist });
    } else {
      res.status(200).send("<!-- Review UI: run 'pnpm build' to serve the client -->");
    }
  });

  return app;
}
