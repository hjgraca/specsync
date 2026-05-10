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

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
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
  const clientDist = resolve(__dirname, "../../dist/client");

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }

  app.get("/qa/:sessionId", (_req, res) => {
    const candidates = [
      resolve(clientDist, "qa/index.html"),
      resolve(clientDist, "src/client/qa/index.html"),
    ];
    const indexPath = candidates.find(existsSync);
    if (indexPath) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("<!-- Q&A UI: run 'pnpm build' to serve the client -->");
    }
  });

  app.get("/review/:slug", (_req, res) => {
    const candidates = [
      resolve(clientDist, "review/index.html"),
      resolve(clientDist, "src/client/review/index.html"),
    ];
    const indexPath = candidates.find(existsSync);
    if (indexPath) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("<!-- Review UI: run 'pnpm build' to serve the client -->");
    }
  });

  return app;
}
