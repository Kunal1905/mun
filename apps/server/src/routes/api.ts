import { Router, type Request } from "express";
import { and, asc, count, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { AGENDA_CATEGORIES, LIMITS, type FeedbackView } from "@mun/shared";
import { requireAdmin, requireUser } from "../auth.js";
import { db } from "../db/index.js";
import {
  agendas,
  chatMessages,
  dailyCrises,
  dailyEntries,
  dailyVotes,
  feedback,
  playerStats,
  reports,
  resolutions,
  roomPlayers,
  rooms,
  rounds,
  speeches,
  users,
} from "../db/schema.js";
import type { RoomManager } from "../game/RoomManager.js";

const me = (req: Request) => req.appUser!;
const today = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid request.");
  return result.data;
}

const toFeedbackView = (row: typeof feedback.$inferSelect, roomName: string): FeedbackView => ({
  id: row.id,
  roomId: row.roomId,
  roomName,
  clarity: row.clarity,
  relevance: row.relevance,
  persuasiveness: row.persuasiveness,
  conciseness: row.conciseness,
  advice: row.advice,
  bestLine: row.bestLine,
  summary: row.summary,
  source: row.source as FeedbackView["source"],
  createdAt: row.createdAt.toISOString(),
});

export function apiRouter(manager: RoomManager) {
  const api = Router();

  // ------------------------------------------------------------ public

  api.get("/stats/overview", async (_req, res) => {
    const [[players], [games], [resolutionCount]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(rooms).where(eq(rooms.status, "finished")),
      db.select({ n: count() }).from(resolutions),
    ]);
    res.json({
      players: players?.n ?? 0,
      gamesPlayed: games?.n ?? 0,
      resolutions: resolutionCount?.n ?? 0,
      ...manager.liveCounts(),
    });
  });

  api.get("/leaderboard", async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const rows = await db
      .select({
        userId: playerStats.userId,
        displayName: users.displayName,
        imageUrl: users.imageUrl,
        points: playerStats.points,
        gamesPlayed: playerStats.gamesPlayed,
        gamesWon: playerStats.gamesWon,
        roundsWon: playerStats.roundsWon,
        votesReceived: playerStats.votesReceived,
        zeroVoteRounds: playerStats.zeroVoteRounds,
      })
      .from(playerStats)
      .innerJoin(users, eq(users.id, playerStats.userId))
      .where(gt(playerStats.gamesPlayed, 0))
      // Points, then the tie-breaks from the design: total votes, then fewest zero-vote rounds.
      .orderBy(desc(playerStats.points), desc(playerStats.votesReceived), asc(playerStats.zeroVoteRounds), asc(users.displayName))
      .limit(limit);
    res.json({ rows: rows.map((r, i) => ({ rank: i + 1, ...r })) });
  });

  api.get("/agendas/categories", async (_req, res) => {
    const rows = await db
      .select({ category: agendas.category, n: count() })
      .from(agendas)
      .where(and(eq(agendas.status, "active"), eq(agendas.isCustom, false)))
      .groupBy(agendas.category);
    const counts = new Map(rows.map((r) => [r.category, r.n]));
    res.json({
      categories: [...new Set([...AGENDA_CATEGORIES, ...counts.keys()])]
        .map((c) => ({ id: c, count: counts.get(c) ?? 0 }))
        .filter((c) => c.count > 0),
    });
  });

  // Everything below needs a signed-in user.
  api.use(requireUser);

  // ------------------------------------------------------------ me / profile

  api.get("/me", async (req, res) => {
    const user = me(req);
    const [stats] = await db.select().from(playerStats).where(eq(playerStats.userId, user.id));
    let rank: number | null = null;
    if (stats && stats.gamesPlayed > 0) {
      const [ahead] = await db
        .select({ n: count() })
        .from(playerStats)
        .where(and(gt(playerStats.gamesPlayed, 0), gt(playerStats.points, stats.points)));
      rank = (ahead?.n ?? 0) + 1;
    }
    res.json({ user, stats: stats ?? null, rank });
  });

  api.patch("/me", async (req, res) => {
    const body = parse(
      z.object({ displayName: z.string().trim().min(2, "Name is too short.").max(LIMITS.displayName) }),
      req.body,
    );
    await db.update(users).set({ displayName: body.displayName }).where(eq(users.id, me(req).id));
    res.json({ ok: true });
  });

  api.get("/me/history", async (req, res) => {
    const user = me(req);
    const games = await db
      .select({
        roomId: rooms.id,
        code: rooms.code,
        name: rooms.name,
        finishedAt: rooms.finishedAt,
        ranked: rooms.ranked,
        roundsTotal: rooms.roundsTotal,
        roundWins: roomPlayers.roundWins,
        votesReceived: roomPlayers.votesReceived,
        isWinner: roomPlayers.isWinner,
      })
      .from(roomPlayers)
      .innerJoin(rooms, eq(rooms.id, roomPlayers.roomId))
      .where(and(eq(roomPlayers.userId, user.id), eq(rooms.status, "finished")))
      .orderBy(desc(rooms.finishedAt))
      .limit(30);

    const fb = await db
      .select({ row: feedback, roomName: rooms.name })
      .from(feedback)
      .innerJoin(rooms, eq(rooms.id, feedback.roomId))
      .where(eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt))
      .limit(30);

    res.json({ games, feedback: fb.map((f) => toFeedbackView(f.row, f.roomName)) });
  });

  api.get("/feedback/:roomId", async (req, res) => {
    const [row] = await db
      .select({ row: feedback, roomName: rooms.name })
      .from(feedback)
      .innerJoin(rooms, eq(rooms.id, feedback.roomId))
      .where(and(eq(feedback.roomId, req.params.roomId as string), eq(feedback.userId, me(req).id)));
    res.json({ feedback: row ? toFeedbackView(row.row, row.roomName) : null });
  });

  // ------------------------------------------------------------ rooms

  api.get("/rooms", (_req, res) => {
    res.json({ rooms: manager.publicRooms() });
  });

  api.post("/rooms", async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(3, "Give the room a name.").max(LIMITS.roomName),
        visibility: z.enum(["public", "private"]).default("public"),
        agendaMode: z.enum(["random", "custom"]).default("random"),
        category: z.string().trim().max(40).nullable().default(null),
        customAgendas: z.array(z.string().trim().max(LIMITS.customAgenda)).max(LIMITS.maxRounds).default([]),
        roundsTotal: z.number().int().min(LIMITS.minRounds).max(LIMITS.maxRounds).default(3),
        maxPlayers: z.number().int().min(LIMITS.minPlayers).max(LIMITS.maxPlayers).default(8),
      }),
      req.body,
    );
    const customAgendas = body.customAgendas.filter((a) => a.length >= 8);
    if (body.agendaMode === "custom" && customAgendas.length === 0)
      throw new HttpError(400, "Write at least one custom agenda (8+ characters).");
    const room = await manager.createRoom(me(req), { ...body, category: body.category || null, customAgendas });
    res.status(201).json({ code: room.code });
  });

  api.get("/rooms/:code", (req, res) => {
    const room = manager.get(req.params.code as string);
    if (!room) throw new HttpError(404, "Room not found.");
    res.json({ code: room.code, name: room.config.name, phase: room.phase, players: room.activeMembers.length });
  });

  // ------------------------------------------------------------ replay

  api.get("/replay/:roomId", async (req, res) => {
    const roomId = req.params.roomId as string;
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        players: { orderBy: [desc(roomPlayers.roundWins), desc(roomPlayers.votesReceived)] },
        rounds: {
          orderBy: [asc(rounds.number)],
          with: {
            agenda: true,
            speeches: { orderBy: [asc(speeches.order)] },
            resolutions: { orderBy: [desc(resolutions.votes)] },
          },
        },
      },
    });
    if (!room || room.status !== "finished") throw new HttpError(404, "Replay not available.");
    const isMember = room.players.some((p) => p.userId === me(req).id);
    if (room.visibility === "private" && !isMember && !me(req).isAdmin)
      throw new HttpError(403, "This was a private room.");

    const chat = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.roomId, roomId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(500);
    res.json({ room, chat });
  });

  // ------------------------------------------------------------ daily crisis

  async function ensureDaily(date: string, create: boolean) {
    const existing = await db.query.dailyCrises.findFirst({ where: eq(dailyCrises.date, date), with: { agenda: true } });
    if (existing || !create) return existing ?? null;

    const recent = await db
      .select({ agendaId: dailyCrises.agendaId })
      .from(dailyCrises)
      .orderBy(desc(dailyCrises.date))
      .limit(14);
    const pool = and(eq(agendas.status, "active"), eq(agendas.isCustom, false));
    const where = recent.length ? and(pool, notInArray(agendas.id, recent.map((r) => r.agendaId))) : pool;
    const pick = async (w: typeof where) =>
      (await db.select().from(agendas).where(w).orderBy(sql`random()`).limit(1))[0];
    const agenda = (await pick(where)) ?? (await pick(pool));
    if (!agenda) throw new HttpError(503, "No agendas available. Run the seed script.");
    await db.insert(dailyCrises).values({ date, agendaId: agenda.id }).onConflictDoNothing();
    return db.query.dailyCrises.findFirst({ where: eq(dailyCrises.date, date), with: { agenda: true } });
  }

  async function entriesWithVotes(crisisId: string) {
    return db
      .select({
        id: dailyEntries.id,
        userId: dailyEntries.userId,
        displayName: dailyEntries.displayName,
        text: dailyEntries.text,
        votes: count(dailyVotes.id),
      })
      .from(dailyEntries)
      .leftJoin(dailyVotes, eq(dailyVotes.entryId, dailyEntries.id))
      .where(eq(dailyEntries.dailyCrisisId, crisisId))
      .groupBy(dailyEntries.id)
      .orderBy(asc(dailyEntries.createdAt));
  }

  api.get("/daily", async (req, res) => {
    const user = me(req);
    const crisis = await ensureDaily(today(), true);
    if (!crisis) throw new HttpError(503, "Daily crisis unavailable.");
    const entries = await entriesWithVotes(crisis.id);
    const [myVote] = await db
      .select()
      .from(dailyVotes)
      .where(and(eq(dailyVotes.dailyCrisisId, crisis.id), eq(dailyVotes.voterId, user.id)));
    const revealed = !!myVote;

    const yesterday = await ensureDaily(today(-1), false);
    let yesterdayWinner = null;
    if (yesterday) {
      const prev = (await entriesWithVotes(yesterday.id)).sort((a, b) => b.votes - a.votes)[0];
      if (prev && prev.votes > 0)
        yesterdayWinner = { agendaTitle: yesterday.agenda.title, displayName: prev.displayName, text: prev.text, votes: prev.votes };
    }

    res.json({
      date: crisis.date,
      agenda: { id: crisis.agenda.id, title: crisis.agenda.title, brief: crisis.agenda.brief, category: crisis.agenda.category },
      // Authors and counts stay hidden until you have voted, so voting is blind.
      entries: entries
        .map((e) => ({
          id: e.id,
          text: e.text,
          isMine: e.userId === user.id,
          displayName: revealed || e.userId === user.id ? e.displayName : null,
          votes: revealed ? e.votes : null,
        }))
        .sort((a, b) => (revealed ? (b.votes ?? 0) - (a.votes ?? 0) : a.id.localeCompare(b.id))),
      myEntry: entries.find((e) => e.userId === user.id)?.text ?? null,
      myVote: myVote?.entryId ?? null,
      yesterdayWinner,
    });
  });

  api.post("/daily/entry", async (req, res) => {
    const user = me(req);
    const body = parse(z.object({ text: z.string().trim().min(8, "Write a full resolution.").max(LIMITS.resolution) }), req.body);
    const crisis = await ensureDaily(today(), true);
    if (!crisis) throw new HttpError(503, "Daily crisis unavailable.");
    const inserted = await db
      .insert(dailyEntries)
      .values({ dailyCrisisId: crisis.id, userId: user.id, displayName: user.displayName, text: body.text })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) throw new HttpError(409, "You already submitted today's resolution.");
    res.status(201).json({ ok: true });
  });

  api.post("/daily/vote", async (req, res) => {
    const user = me(req);
    const body = parse(z.object({ entryId: z.string().min(1) }), req.body);
    const crisis = await ensureDaily(today(), true);
    if (!crisis) throw new HttpError(503, "Daily crisis unavailable.");
    const [entry] = await db
      .select()
      .from(dailyEntries)
      .where(and(eq(dailyEntries.id, body.entryId), eq(dailyEntries.dailyCrisisId, crisis.id)));
    if (!entry) throw new HttpError(404, "That resolution is not part of today's crisis.");
    if (entry.userId === user.id) throw new HttpError(400, "You cannot vote for your own resolution.");
    const inserted = await db
      .insert(dailyVotes)
      .values({ dailyCrisisId: crisis.id, entryId: entry.id, voterId: user.id })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) throw new HttpError(409, "You already voted today.");
    res.status(201).json({ ok: true });
  });

  // ------------------------------------------------------------ reports

  api.post("/reports", async (req, res) => {
    const body = parse(
      z.object({
        targetType: z.enum(["resolution", "chat", "daily_entry", "speech"]),
        targetId: z.string().min(1).max(100),
        targetText: z.string().max(LIMITS.speech).default(""),
        reason: z.string().trim().min(3, "Tell us what is wrong.").max(LIMITS.reportReason),
      }),
      req.body,
    );
    // Prefer the stored text; live-game content is only persisted at round end.
    let storedText: string | undefined;
    if (body.targetType === "resolution")
      storedText = (await db.select({ t: resolutions.text }).from(resolutions).where(eq(resolutions.id, body.targetId)))[0]?.t;
    if (body.targetType === "chat")
      storedText = (await db.select({ t: chatMessages.text }).from(chatMessages).where(eq(chatMessages.id, body.targetId)))[0]?.t;
    if (body.targetType === "daily_entry")
      storedText = (await db.select({ t: dailyEntries.text }).from(dailyEntries).where(eq(dailyEntries.id, body.targetId)))[0]?.t;

    await db.insert(reports).values({
      reporterId: me(req).id,
      targetType: body.targetType,
      targetId: body.targetId,
      targetText: storedText ?? body.targetText,
      reason: body.reason,
    });
    res.status(201).json({ ok: true });
  });

  // ------------------------------------------------------------ admin

  const admin = Router();
  admin.use(requireAdmin);

  admin.get("/overview", async (_req, res) => {
    const [[u], [r], [open], [a]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(rooms).where(eq(rooms.status, "finished")),
      db.select({ n: count() }).from(reports).where(eq(reports.status, "open")),
      db.select({ n: count() }).from(agendas).where(and(eq(agendas.status, "active"), eq(agendas.isCustom, false))),
    ]);
    res.json({ users: u?.n ?? 0, gamesFinished: r?.n ?? 0, openReports: open?.n ?? 0, activeAgendas: a?.n ?? 0, ...manager.liveCounts() });
  });

  const agendaBody = z.object({
    title: z.string().trim().min(5).max(LIMITS.customAgenda),
    brief: z.string().trim().min(10).max(600),
    category: z.string().trim().min(2).max(40),
    stakeholders: z.array(z.string().trim().min(2).max(60)).min(2).max(16),
    twist: z.string().trim().max(300).nullable().optional(),
    status: z.enum(["active", "archived"]).default("active"),
  });

  admin.get("/agendas", async (_req, res) => {
    const rows = await db
      .select()
      .from(agendas)
      .where(eq(agendas.isCustom, false))
      .orderBy(asc(agendas.category), asc(agendas.title));
    res.json({ agendas: rows });
  });

  admin.post("/agendas", async (req, res) => {
    const body = parse(agendaBody, req.body);
    const [row] = await db.insert(agendas).values({ ...body, twist: body.twist || null }).returning();
    res.status(201).json({ agenda: row });
  });

  admin.patch("/agendas/:id", async (req, res) => {
    const body = parse(agendaBody.partial(), req.body);
    const [row] = await db
      .update(agendas)
      .set({ ...body, ...(body.twist !== undefined ? { twist: body.twist || null } : {}) })
      .where(eq(agendas.id, req.params.id as string))
      .returning();
    if (!row) throw new HttpError(404, "Agenda not found.");
    res.json({ agenda: row });
  });

  admin.get("/reports", async (req, res) => {
    const status = req.query.status === "resolved" ? "resolved" : "open";
    const rows = await db.select().from(reports).where(eq(reports.status, status)).orderBy(desc(reports.createdAt)).limit(100);
    const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
    const names = reporterIds.length
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, reporterIds))
      : [];
    const nameOf = new Map(names.map((n) => [n.id, n.displayName]));
    res.json({ reports: rows.map((r) => ({ ...r, reporterName: nameOf.get(r.reporterId) ?? "Unknown" })) });
  });

  admin.patch("/reports/:id", async (req, res) => {
    const body = parse(z.object({ status: z.enum(["open", "resolved"]) }), req.body);
    await db.update(reports).set({ status: body.status }).where(eq(reports.id, req.params.id as string));
    res.json({ ok: true });
  });

  api.use("/admin", admin);

  return api;
}

export { HttpError };
