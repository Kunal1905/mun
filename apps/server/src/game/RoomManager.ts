import { inArray } from "drizzle-orm";
import type { Server } from "socket.io";
import type { AgendaMode, ClientToServerEvents, RoomListItem, ServerToClientEvents, Visibility } from "@mun/shared";
import { db } from "../db/index.js";
import { rooms } from "../db/schema.js";
import { env } from "../env.js";
import type { AppUser } from "../auth.js";
import { coachGame } from "./coaching.js";
import { dbStore } from "./dbStore.js";
import { GameRoom } from "./GameRoom.js";
import type { PhaseDurationsMs, RoomTransport } from "./types.js";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export interface RoomSettings {
  name: string;
  visibility: Visibility;
  agendaMode: AgendaMode;
  category: string | null;
  customAgendas: string[];
  roundsTotal: number;
  maxPlayers: number;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_ROOM_TTL_MS = 3 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 20 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, GameRoom>(); // by code
  private socketRoom = new Map<string, string>(); // socket id -> room code
  private lobbyTimer: NodeJS.Timeout | null = null;
  readonly transport: RoomTransport;

  constructor(
    private readonly io: IO,
    private readonly durations?: Partial<PhaseDurationsMs>,
  ) {
    this.transport = {
      emit: (socketIds, event, payload) => {
        const ids = [...socketIds];
        if (ids.length) (this.io.to(ids) as unknown as { emit: (e: string, p: unknown) => void }).emit(event, payload);
      },
    };
    setInterval(() => this.sweep(), 30_000).unref();
  }

  /** Rooms are held in memory; anything left open by a previous process can no longer be played. */
  async closeStaleRooms() {
    await db
      .update(rooms)
      .set({ status: "abandoned" })
      .where(inArray(rooms.status, ["lobby", "in_progress"]));
  }

  async createRoom(host: AppUser, settings: RoomSettings): Promise<GameRoom> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
      if (this.rooms.has(code)) continue;
      const [row] = await db
        .insert(rooms)
        .values({ code, hostId: host.id, ...settings })
        .onConflictDoNothing()
        .returning();
      if (!row) continue;

      const room = new GameRoom(
        {
          id: row.id,
          code,
          name: settings.name,
          hostUserId: host.id,
          visibility: settings.visibility,
          agendaMode: settings.agendaMode,
          category: settings.category,
          customAgendas: settings.customAgendas,
          roundsTotal: settings.roundsTotal,
          maxPlayers: settings.maxPlayers,
        },
        {
          store: dbStore,
          transport: this.transport,
          durations: this.durations,
          minPlayersForRanked: env.MIN_PLAYERS_FOR_RANKED,
          onChange: () => this.scheduleLobbyBroadcast(),
          onFinished: (game) =>
            void coachGame(game, (userId, feedback) => room.sendToUser(userId, "feedback:ready", feedback)),
        },
      );
      this.rooms.set(code, room);
      return room;
    }
    throw new Error("Could not allocate a room code. Try again.");
  }

  get(code: string) {
    return this.rooms.get(code.trim().toUpperCase());
  }

  bindSocket(socketId: string, code: string) {
    this.socketRoom.set(socketId, code);
  }

  roomForSocket(socketId: string) {
    const code = this.socketRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  unbindSocket(socketId: string) {
    const room = this.roomForSocket(socketId);
    this.socketRoom.delete(socketId);
    return room;
  }

  publicRooms(): RoomListItem[] {
    return [...this.rooms.values()]
      .map((r) => r.listing())
      .filter((r): r is RoomListItem => r !== null)
      .sort((a, b) => b.players - a.players);
  }

  liveCounts() {
    const all = [...this.rooms.values()].filter((r) => !r.destroyed);
    return {
      liveRooms: all.filter((r) => r.phase !== "finished").length,
      playersOnline: all.reduce((n, r) => n + r.connectedMembers.length, 0),
    };
  }

  private scheduleLobbyBroadcast() {
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.io.to("lobby").emit("lobby:rooms", this.publicRooms());
    }, 250);
  }

  private sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivity;
      const expired =
        (room.isEmpty() && idle > EMPTY_ROOM_TTL_MS) || (room.phase === "finished" && idle > FINISHED_ROOM_TTL_MS);
      if (!expired) continue;
      if (room.phase !== "finished") {
        void dbStore.updateRoom(room.config.id, { status: "abandoned" }).catch(() => {});
      }
      room.destroy();
      this.rooms.delete(code);
      for (const [socketId, c] of this.socketRoom) if (c === code) this.socketRoom.delete(socketId);
      this.scheduleLobbyBroadcast();
    }
  }
}
