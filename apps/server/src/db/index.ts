import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Neon is the primary database. Its serverless driver (WebSockets) supports transactions,
 * which the game needs when it saves a round. For a plain local Postgres (docker compose),
 * the same schema runs over node-postgres instead.
 */
const isNeon = /\.neon\.tech|neon\.build/i.test(env.DATABASE_URL);

function createDb() {
  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    return drizzleNeon({ client: new NeonPool({ connectionString: env.DATABASE_URL }), schema });
  }
  // Same query builder and pg dialect; typed as the Neon flavour so call sites stay uniform.
  return drizzlePg({ client: new pg.Pool({ connectionString: env.DATABASE_URL }), schema }) as unknown as ReturnType<
    typeof drizzleNeon<typeof schema>
  >;
}

export const db = createDb();
export type Db = typeof db;
export { schema };
