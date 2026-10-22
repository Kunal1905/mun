import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { RoomState } from "@mun/shared";
import { GameRoom, type FinishedGame } from "../src/game/GameRoom.js";
import type { GameRecord, GameStore, RoomConfig, RoundRecord } from "../src/game/types.js";

function memoryStore() {
  let n = 0;
  const saved = { rounds: [] as RoundRecord[], games: [] as GameRecord[], chat: 0 };
  const store: GameStore = {
    upsertPlayer: async (_roomId, user) => `p_${user.id}`,
    removePlayer: async () => {},
    updateRoom: async () => {},
    pickAgenda: async () => ({
      id: `agenda_${++n}`,
      title: `Crisis ${n}`,
      brief: "A test crisis about water rights and border security.",
      category: "security",
      twist: "The dam has burst.",
      stakeholders: ["India", "China", "Nepal"],
    }),
    createRound: async (_roomId, number) => `round_${number}`,
    saveRound: async (r) => void saved.rounds.push(r),
    finishGame: async (g) => void saved.games.push(g),
    saveChat: async () => void saved.chat++,
  };
  return { store, saved };
}

function harness(roundsTotal = 2) {
  const states = new Map<string, RoomState>();
  const events: { socket: string; event: string; payload: unknown }[] = [];
  const { store, saved } = memoryStore();
  let finished: FinishedGame | null = null;
  const config: RoomConfig = {
    id: "room1",
    code: "ABC123",
    name: "Test Room",
    hostUserId: "alice",
    visibility: "public",
    agendaMode: "random",
    category: null,
    customAgendas: [],
    roundsTotal,
    maxPlayers: 8,
  };
  const room = new GameRoom(config, {
    store,
    minPlayersForRanked: 3,
    transport: {
      emit(socketIds, event, payload) {
        for (const s of socketIds) {
          if (event === "room:state") states.set(s, payload as RoomState);
          events.push({ socket: s, event, payload });
        }
      },
    },
    onFinished: (g) => (finished = g),
  });
  return { room, states, events, saved, finished: () => finished };
}

const players = [
  { id: "alice", displayName: "Alice", imageUrl: null, socket: "s-alice" },
  { id: "bob", displayName: "Bob", imageUrl: null, socket: "s-bob" },
  { id: "cara", displayName: "Cara", imageUrl: null, socket: "s-cara" },
];

async function flush() {
  // Let pending promises (store calls inside startRound) settle.
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("GameRoom", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a full multiplayer game: debate, drafting, voting, reveal, standings", async () => {
    const h = harness(2);
    for (const p of players) expect((await h.room.join(p, p.socket)).ok).toBe(true);

    // Host cannot start until everyone is ready.
    expect((await h.room.start("s-alice")).ok).toBe(false);
    h.room.setReady("s-bob", true);
    h.room.setReady("s-cara", true);
    expect((await h.room.start("s-bob")).ok).toBe(false); // not host
    expect((await h.room.start("s-alice")).ok).toBe(true);
    await flush();

    let s = h.states.get("s-alice")!;
    expect(s.phase).toBe("agenda");
    expect(s.ranked).toBe(true);
    expect(s.players.every((p) => p.delegation)).toBe(true);

    for (let round = 1; round <= 2; round++) {
      vi.advanceTimersByTime(12_000); // agenda -> debate
      await flush();

      // Each speaker talks; others react; one POI.
      for (let turn = 0; turn < 3; turn++) {
        s = h.states.get("s-alice")!;
        expect(s.phase).toBe("debate");
        const speaker = players.find((p) => `p_${p.id}` === s.currentSpeakerId)!;
        h.room.updateSpeech(speaker.socket, `As ${speaker.displayName} I propose shared water monitoring at the border.`);
        const listener = players.find((p) => p !== speaker)!;
        h.room.react(listener.socket, `p_${speaker.id}`, "agree");
        if (turn === 0) h.room.raisePoi(listener.socket, "Who pays for it?");
        if (turn === 1) h.room.yieldFloor(speaker.socket);
        else vi.advanceTimersByTime(60_000);
        await flush();
      }

      s = h.states.get("s-alice")!;
      expect(s.phase).toBe("drafting");
      expect(s.agenda?.twist).toBe("The dam has burst.");

      // Too-short resolutions are rejected; everyone submitting ends drafting early.
      expect(h.room.submitResolution("s-alice", "short").ok).toBe(false);
      for (const p of players) expect(h.room.submitResolution(p.socket, `${p.displayName}: fund a joint monitoring commission`).ok).toBe(true);
      s = h.states.get("s-alice")!;
      expect(s.phase).toBe("voting");
      expect(s.resolutions).toHaveLength(3);
      expect(s.resolutions.filter((r) => r.isMine)).toHaveLength(1);

      // Self-votes are rejected; Bob's resolution gets two votes.
      const view = (socket: string) => h.states.get(socket)!.resolutions;
      const mine = view("s-alice").find((r) => r.isMine)!;
      expect(h.room.castVote("s-alice", mine.id).ok).toBe(false);
      const bobRes = view("s-alice").find((r) => r.text.startsWith("Bob"))!;
      expect(h.room.castVote("s-alice", bobRes.id).ok).toBe(true);
      expect(h.room.castVote("s-cara", bobRes.id).ok).toBe(true);
      const aliceRes = view("s-bob").find((r) => r.text.startsWith("Alice"))!;
      expect(h.room.castVote("s-bob", aliceRes.id).ok).toBe(true);

      s = h.states.get("s-alice")!;
      expect(s.phase).toBe("reveal");
      expect(s.reveal[0]!.displayName).toBe("Bob");
      expect(s.reveal[0]!.votes).toBe(2);
      expect(s.reveal[0]!.isWinner).toBe(true);

      vi.advanceTimersByTime(15_000);
      await flush();
    }

    s = h.states.get("s-cara")!;
    expect(s.phase).toBe("finished");
    expect(s.standings[0]!.displayName).toBe("Bob");
    expect(s.standings[0]!.roundWins).toBe(2);
    expect(s.standings[0]!.isWinner).toBe(true);
    // Tie-break order: Alice (2 votes) ahead of Cara (0 votes).
    expect(s.standings.map((x) => x.displayName)).toEqual(["Bob", "Alice", "Cara"]);

    expect(h.saved.rounds).toHaveLength(2);
    expect(h.saved.rounds[0]!.speeches).toHaveLength(3);
    expect(h.saved.rounds[0]!.speeches.some((sp) => sp.poiText === "Who pays for it?")).toBe(true);
    expect(h.saved.games[0]!.ranked).toBe(true);
    expect(h.finished()?.players).toHaveLength(3);
  });

  it("enforces lobby rules: capacity, late joins, host transfer", async () => {
    const h = harness(1);
    await h.room.join(players[0]!, "s-alice");
    await h.room.join(players[1]!, "s-bob");

    // Host leaves the lobby -> Bob becomes host.
    h.room.leave("s-alice");
    expect(h.states.get("s-bob")!.me!.isHost).toBe(true);

    await h.room.join(players[2]!, "s-cara");
    h.room.setReady("s-cara", true);
    expect((await h.room.start("s-bob")).ok).toBe(true);
    await flush();

    // Nobody new can join once the game has started, but members can reconnect.
    const late = await h.room.join({ id: "dan", displayName: "Dan", imageUrl: null }, "s-dan");
    expect(late.ok).toBe(false);
    h.room.disconnect("s-cara");
    expect((await h.room.join(players[2]!, "s-cara-2")).ok).toBe(true);
    expect(h.states.get("s-cara-2")!.phase).toBe("agenda");
    // Two players is below MIN_PLAYERS_FOR_RANKED=3.
    expect(h.states.get("s-cara-2")!.ranked).toBe(false);
  });

  it("skips a speaker who drops and does not wait on absent voters", async () => {
    const h = harness(1);
    for (const p of players) await h.room.join(p, p.socket);
    h.room.setReady("s-bob", true);
    h.room.setReady("s-cara", true);
    await h.room.start("s-alice");
    await flush();
    vi.advanceTimersByTime(12_000);
    await flush();

    const first = h.states.get("s-alice")!.currentSpeakerId!;
    const dropped = players.find((p) => `p_${p.id}` === first)!;
    h.room.disconnect(dropped.socket);
    vi.advanceTimersByTime(8_000); // speaker grace
    const observer = players.find((p) => p !== dropped)!;
    expect(h.states.get(observer.socket)!.currentSpeakerId).not.toBe(first);

    // Remaining two finish their turns.
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);
    expect(h.states.get(observer.socket)!.phase).toBe("drafting");

    const online = players.filter((p) => p !== dropped);
    for (const p of online) h.room.submitResolution(p.socket, `${p.displayName} proposes a ceasefire monitoring body`);
    expect(h.states.get(observer.socket)!.phase).toBe("voting");
    const [a, b] = online;
    const bRes = h.states.get(a!.socket)!.resolutions.find((r) => !r.isMine)!;
    const aRes = h.states.get(b!.socket)!.resolutions.find((r) => !r.isMine)!;
    h.room.castVote(a!.socket, bRes.id);
    h.room.castVote(b!.socket, aRes.id);
    const s = h.states.get(observer.socket)!;
    expect(s.phase).toBe("reveal");
    // A tie: both share the round.
    expect(s.reveal.filter((r) => r.isWinner)).toHaveLength(2);
  });
});
