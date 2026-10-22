import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The monorepo keeps a single .env at the repository root (drizzle-kit runs from apps/server).
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
