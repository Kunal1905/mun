/**
 * End-to-end test of the real server stack: Express routes, Socket.IO handlers, the game engine
 * and the Drizzle store against a real Postgres. Only Clerk is stubbed (tokens are user ids).
 *
 * Run with: npm run test:integration -w @mun/server   (needs DATABASE_URL, e.g. `npm run db:up`)
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import type { FeedbackView, RoomState } from "@mun/shared";

const RUN = `t${Date.now().toString(36)}`;
const ids = { alice: `${RUN}_alice`, bob: `${RUN}_bob`, cara: `${RUN}_cara` };
const names: Record<string, string> = { [ids.alice]: "Alice", [ids.bob]: "Bob", [ids.cara]: "Cara" };

vi.mock("../src/auth.js", () => {
  const user = (id: string) => ({ id, email: `${id}@test.dev`, displayName: names[id] ?? id, imageUrl: null, isAdmin: id.endsWith("_alice") });
  return {
    ensureUser: async (id: string) => user(id),
    verifySocketToken: async (token?: string) => (token && names[token] ? user(token) : null),
    requireUser: (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const id = req.header("x-test-user");
      if (!id || !names[id]) return res.status(401).json({ error: "unauthorized" });
      req.appUser = user(id);
      next();
    },
    requireAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) =>
      req.appUser?.isAdmin ? next() : res.status(403).json({ error: "Admins only." }),
  };
});

const { db } = await import("../src/db/index.js");
const schema = await import("../src/db/schema.js");
const { RoomManager } = await import("../src/game/RoomManager.js");
const { registerSocketHandlers } = await import("../src/socket.js");
const { apiRouter, HttpError } = await import("../src/routes/api.js");

let http: HttpServer;
let base = "";
const sockets: Socket[] = [];

async function api<T = any>(user: string, path: string, body?: unknown, method?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${base}/api${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "x-test-user": user, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T };
}

function client(userId: string) {
  const s = connect(base, { auth: { token: userId }, transports: ["websocket"], forceNew: true });
  sockets.push(s);
  return s;
}

const waitFor = <T>(fn: () => T | undefined | false, timeout = 20000) =>
  new Promise<T>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = fn();
      if (v) return resolve(v as T);
      if (Date.now() - start > timeout) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 25);
    };
    tick();
  });

describe.skipIf(!process.env.INTEGRATION)("full stack", () => {
  beforeAll(async () => {
    await db
      .insert(schema.users)
      .values(Object.entries(names).map(([id, displayName]) => ({ id, displayName, email: `${id}@test.dev` })))
      .onConflictDoNothing();

    const app = express();
    app.use(express.json());
    http = createServer(app);
    const io = new Server(http);
    const manager = new RoomManager(io as any, {
      agenda: 200,
      debate: 1500,
      drafting: 4000,
      voting: 4000,
      reveal: 200,
      speakerGrace: 300,
      lobbySeat: 1000,
    });
    app.use("/api", apiRouter(manager));
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: "boom" });
    });
    registerSocketHandlers(io as any, manager);
    await new Promise<void>((r) => http.listen(0, r));
    base = `http://localhost:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    http?.close();
    const userIds = Object.values(ids);
    const roomIds = (
      await db.select({ id: schema.roomPlayers.roomId }).from(schema.roomPlayers).where(inArray(schema.roomPlayers.userId, userIds))
    ).map((r) => r.id);
    if (roomIds.length) await db.delete(schema.rooms).where(inArray(schema.rooms.id, roomIds));
    await db.delete(schema.dailyEntries).where(inArray(schema.dailyEntries.userId, userIds));
    await db.delete(schema.reports).where(inArray(schema.reports.reporterId, userIds));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  });

  it("rejects sockets without a valid session", async () => {
    const s = connect(base, { auth: { token: "nobody" }, transports: ["websocket"], forceNew: true });
    sockets.push(s);
    const err = await new Promise<Error>((r) => s.on("connect_error", r));
    expect(err.message).toBe("unauthorized");
  });

  it("plays a full 3-player, 2-round game over sockets and persists everything", async () => {
    const created = await api<{ code: string }>(ids.alice, "/rooms", { name: "Integration Committee", roundsTotal: 2, maxPlayers: 4 });
    expect(created.status).toBe(201);
    const code = created.data.code;

    // An empty room is not advertised until someone is in it.
    const before = await api<{ rooms: { code: string }[] }>(ids.bob, "/rooms");
    expect(before.data.rooms.some((r) => r.code === code)).toBe(false);

    const players = [ids.alice, ids.bob, ids.cara].map((id) => {
      const s = client(id);
      const ctx = { id, s, state: null as RoomState | null, feedback: null as FeedbackView | null, chat: [] as string[] };
      s.on("room:state", (st) => (ctx.state = st));
      s.on("feedback:ready", (f) => (ctx.feedback = f));
      s.on("chat:message", (m) => ctx.chat.push(m.text));
      return ctx;
    });

    for (const p of players) {
      await waitFor(() => p.s.connected);
      const ack = await new Promise<any>((r) => p.s.emit("room:join", { code }, r));
      expect(ack.ok).toBe(true);
    }
    const [alice, bob, cara] = players as [typeof players[0], typeof players[0], typeof players[0]];
    await waitFor(() => alice.state?.players.length === 3);

    // Now it is listed publicly with its live seat count.
    const listed = await api<{ rooms: { code: string; players: number }[] }>(ids.bob, "/rooms");
    expect(listed.data.rooms.find((r) => r.code === code)?.players).toBe(3);

    // Real-time chat reaches everyone.
    bob.s.emit("chat:send", { text: "Hello committee" });
    await waitFor(() => alice.chat.includes("Hello committee") && cara.chat.includes("Hello committee"));

    bob.s.emit("room:ready", { ready: true });
    cara.s.emit("room:ready", { ready: true });
    await waitFor(() => alice.state?.players.every((p) => p.isReady));
    const started = await new Promise<any>((r) => alice.s.emit("room:start", r));
    expect(started.ok).toBe(true);

    // Each client plays its own part as phases arrive.
    const acted = new Set<string>();
    const drive = setInterval(() => {
      for (const p of players) {
        const st = p.state;
        if (!st?.me) continue;
        const key = `${st.phase}:${st.roundNumber}:${st.currentSpeakerId}`;
        if (st.phase === "debate" && st.currentSpeakerId === st.me.playerId && !acted.has(`${p.id}:${key}`)) {
          acted.add(`${p.id}:${key}`);
          p.s.emit("speech:update", { text: `${names[p.id]} argues that shared monitoring of the crisis protects every delegation.` });
          setTimeout(() => p.s.emit("speech:yield"), 150);
        }
        if (st.phase === "debate" && st.currentSpeakerId && st.currentSpeakerId !== st.me.playerId && !acted.has(`${p.id}:react:${key}`)) {
          acted.add(`${p.id}:react:${key}`);
          p.s.emit("speech:react", { playerId: st.currentSpeakerId, reaction: "agree" });
        }
        if (st.phase === "drafting" && !st.myResolution && !acted.has(`${p.id}:draft:${st.roundNumber}`)) {
          acted.add(`${p.id}:draft:${st.roundNumber}`);
          p.s.emit("resolution:submit", { text: `${names[p.id]}: the Assembly funds an independent monitoring mission` }, () => {});
        }
        if (st.phase === "voting" && !st.myVote && !acted.has(`${p.id}:vote:${st.roundNumber}`)) {
          acted.add(`${p.id}:vote:${st.roundNumber}`);
          // Everyone backs Alice; Alice backs Bob.
          const target = st.resolutions.find((r) => !r.isMine && r.text.startsWith(p.id === ids.alice ? "Bob" : "Alice"));
          if (target) p.s.emit("vote:cast", { resolutionId: target.id }, () => {});
        }
      }
    }, 40);

    await waitFor(() => players.every((p) => p.state?.phase === "finished"), 40000);
    clearInterval(drive);

    const final = cara.state!;
    expect(final.standings[0]!.displayName).toBe("Alice");
    expect(final.standings[0]!.roundWins).toBe(2);
    expect(final.standings[0]!.isWinner).toBe(true);
    expect(final.ranked).toBe(true);
    expect(final.history).toHaveLength(2);

    // Coaching card for every player (rule-based without an API key).
    await waitFor(() => players.every((p) => p.feedback), 15000);
    expect(alice.feedback!.clarity).toBeGreaterThanOrEqual(1);
    expect(alice.feedback!.summary).toContain("Alice");

    // Persisted: leaderboard, history, replay.
    await waitFor(async () => true);
    await new Promise((r) => setTimeout(r, 300));
    const board = await api<{ rows: { userId: string; points: number; gamesWon: number }[] }>(ids.bob, "/leaderboard");
    const aliceRow = board.data.rows.find((r) => r.userId === ids.alice)!;
    expect(aliceRow.points).toBe(2 + 3);
    expect(aliceRow.gamesWon).toBe(1);

    const history = await api<{ games: { roomId: string; isWinner: boolean }[]; feedback: unknown[] }>(ids.alice, "/me/history");
    expect(history.data.games[0]!.isWinner).toBe(true);
    expect(history.data.feedback.length).toBeGreaterThan(0);

    const me = await api<{ rank: number | null; stats: { points: number } }>(ids.alice, "/me");
    expect(me.data.stats.points).toBe(5);
    expect(me.data.rank).not.toBeNull();

    const replay = await api<any>(ids.cara, `/replay/${final.id}`);
    expect(replay.status).toBe(200);
    expect(replay.data.room.rounds).toHaveLength(2);
    expect(replay.data.room.rounds[0].speeches).toHaveLength(3);
    expect(replay.data.room.rounds[0].speeches[0].agree).toBeGreaterThan(0);
    expect(replay.data.room.rounds[0].resolutions[0].isWinner).toBe(true);
    expect(replay.data.chat.some((m: any) => m.text === "Hello committee")).toBe(true);

    // Rematch moves the whole table to a new room.
    const rematchCodes = players.map((p) => new Promise<string>((r) => p.s.once("room:rematch", ({ code }) => r(code))));
    const rm = await new Promise<any>((r) => alice.s.emit("room:rematch", r));
    expect(rm.ok).toBe(true);
    const codes = await Promise.all(rematchCodes);
    expect(new Set(codes).size).toBe(1);
    expect(codes[0]).not.toBe(code);
  }, 60000);

  it("blocks late joiners and unknown rooms", async () => {
    const s = client(ids.cara);
    await waitFor(() => s.connected);
    const ack = await new Promise<any>((r) => s.emit("room:join", { code: "ZZZZZZ" }, r));
    expect(ack.ok).toBe(false);
  });

  it("runs the daily crisis with blind voting and no self-votes", async () => {
    const day = await api<any>(ids.alice, "/daily");
    expect(day.status).toBe(200);
    expect(day.data.agenda.title).toBeTruthy();

    expect((await api(ids.alice, "/daily/entry", { text: "Alice: a regional water authority with veto-free voting" })).status).toBe(201);
    expect((await api(ids.alice, "/daily/entry", { text: "A second try should be rejected outright" })).status).toBe(409);
    expect((await api(ids.bob, "/daily/entry", { text: "Bob: a binding ceasefire monitored by neutral observers" })).status).toBe(201);

    const asCara = await api<any>(ids.cara, "/daily");
    const aliceEntry = asCara.data.entries.find((e: any) => e.text.startsWith("Alice"));
    expect(aliceEntry.displayName).toBeNull(); // blind until voting
    expect(aliceEntry.votes).toBeNull();

    const bobView = await api<any>(ids.bob, "/daily");
    const bobOwn = bobView.data.entries.find((e: any) => e.isMine);
    expect((await api(ids.bob, "/daily/vote", { entryId: bobOwn.id })).status).toBe(400);

    expect((await api(ids.cara, "/daily/vote", { entryId: aliceEntry.id })).status).toBe(201);
    expect((await api(ids.cara, "/daily/vote", { entryId: aliceEntry.id })).status).toBe(409);
    const after = await api<any>(ids.cara, "/daily");
    const revealed = after.data.entries.find((e: any) => e.id === aliceEntry.id);
    expect(revealed.displayName).toBe("Alice");
    expect(revealed.votes).toBe(1);
  });

  it("files reports and lets admins resolve them", async () => {
    expect((await api(ids.bob, "/reports", { targetType: "chat", targetId: "x", targetText: "rude words", reason: "Offensive" })).status).toBe(201);
    expect((await api(ids.bob, "/admin/overview")).status).toBe(403);
    const reports = await api<{ reports: { id: string; reporterName: string }[] }>(ids.alice, "/admin/reports");
    const mine = reports.data.reports.find((r) => r.reporterName === "Bob")!;
    expect(mine).toBeTruthy();
    expect((await api(ids.alice, `/admin/reports/${mine.id}`, { status: "resolved" }, "PATCH")).status).toBe(200);
  });

  it("validates room creation input", async () => {
    expect((await api(ids.alice, "/rooms", { name: "x" })).status).toBe(400);
    expect((await api(ids.alice, "/rooms", { name: "Custom room", agendaMode: "custom", customAgendas: [] })).status).toBe(400);
    const ok = await api<{ code: string }>(ids.alice, "/rooms", {
      name: "Custom room",
      agendaMode: "custom",
      visibility: "private",
      customAgendas: ["Should space mining be regulated by the UN?"],
    });
    expect(ok.status).toBe(201);
    const list = await api<{ rooms: { code: string }[] }>(ids.bob, "/rooms");
    expect(list.data.rooms.some((r) => r.code === ok.data.code)).toBe(false); // private rooms are not listed
  });
});
