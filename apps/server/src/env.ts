import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Single .env at the monorepo root, shared with the web app.
loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const csv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().default(""),
  CLERK_PUBLISHABLE_KEY: z.string().default(""),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_EMAILS: z.string().default(""),
  MIN_PLAYERS_FOR_RANKED: z.coerce.number().int().min(1).default(3),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
});

// SERVER_PORT wins over PORT so a dev tool exporting PORT for the web app cannot collide with the API.
const parsed = schema.safeParse({ ...process.env, PORT: process.env.SERVER_PORT || process.env.PORT });
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  clientOrigins: csv(parsed.data.CLIENT_ORIGIN),
  adminEmails: csv(parsed.data.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  clerkConfigured: Boolean(parsed.data.CLERK_SECRET_KEY && parsed.data.CLERK_PUBLISHABLE_KEY),
};
