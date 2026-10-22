import { verifyToken } from "@clerk/backend";
import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { LIMITS } from "@mun/shared";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { playerStats, users } from "./db/schema.js";
import { env } from "./env.js";

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string;
  imageUrl: string | null;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const lastSynced = new Map<string, number>();

function toAppUser(row: { id: string; email: string | null; displayName: string; imageUrl: string | null }): AppUser {
  return {
    ...row,
    isAdmin: !!row.email && env.adminEmails.includes(row.email.toLowerCase()),
  };
}

/**
 * Returns the local mirror of a Clerk user, pulling profile data from Clerk on first sight
 * and then at most every few minutes. A display name the player chose in-app is never overwritten.
 */
export async function ensureUser(userId: string): Promise<AppUser> {
  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  const stale = !lastSynced.has(userId) || Date.now() - (lastSynced.get(userId) ?? 0) > SYNC_INTERVAL_MS;
  if (existing && !stale) return toAppUser(existing);

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;
    const clerkName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      clerkUser.username ||
      email?.split("@")[0] ||
      "Delegate";

    const [row] = await db
      .insert(users)
      .values({ id: userId, email, displayName: clerkName.slice(0, LIMITS.displayName), imageUrl: clerkUser.imageUrl ?? null })
      .onConflictDoUpdate({ target: users.id, set: { email, imageUrl: clerkUser.imageUrl ?? null } })
      .returning();
    await db.insert(playerStats).values({ userId }).onConflictDoNothing();
    lastSynced.set(userId, Date.now());
    return toAppUser(row!);
  } catch (err) {
    if (existing) return toAppUser(existing);
    throw err;
  }
}

/** Express middleware: rejects unauthenticated requests and attaches `req.appUser`. */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Sign in to continue." });
    req.appUser = await ensureUser(userId);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.appUser?.isAdmin) return res.status(403).json({ error: "Admins only." });
  next();
}

/** Verifies a Clerk session token sent by the Socket.IO handshake. */
export async function verifySocketToken(token: string | undefined): Promise<AppUser | null> {
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: env.clientOrigins,
    });
    if (!payload.sub) return null;
    return await ensureUser(payload.sub);
  } catch {
    return null;
  }
}
