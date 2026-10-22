import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { Server } from "socket.io";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { env } from "./env.js";
import { RoomManager, type IO } from "./game/RoomManager.js";
import { apiRouter, HttpError } from "./routes/api.js";
import { registerSocketHandlers } from "./socket.js";

const app = express();
const server = createServer(app);
const corsOptions = { origin: env.clientOrigins, credentials: true };

const io: IO = new Server(server, { cors: corsOptions });
const manager = new RoomManager(io);

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req, res) => {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    /* reported below */
  }
  res.status(database ? 200 : 503).json({
    ok: database && env.clerkConfigured,
    database,
    clerk: env.clerkConfigured,
    aiCoaching: Boolean(env.ANTHROPIC_API_KEY),
  });
});

if (env.clerkConfigured) {
  app.use(clerkMiddleware({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.CLERK_PUBLISHABLE_KEY }));
} else {
  console.warn("[auth] CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY are not set - signed-in features are disabled.");
  app.use("/api", (req, res, next) => {
    if (["/health", "/stats/overview", "/leaderboard", "/agendas/categories"].includes(req.path)) return next();
    res.status(503).json({ error: "Authentication is not configured on the server. Add your Clerk keys to .env." });
  });
}

app.use("/api", apiRouter(manager));
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// In production the server also hosts the built web app (single deploy).
const webDist = path.resolve(import.meta.dirname, "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error("[http]", err);
  res.status(500).json({ error: "Something went wrong on our side." });
});

registerSocketHandlers(io, manager);

await manager.closeStaleRooms().catch((err) => {
  console.error("[db] Could not reach the database. Check DATABASE_URL.", err.message);
});

server.listen(env.PORT, () => {
  console.log(`MUN Crisis server listening on http://localhost:${env.PORT}`);
});
