import { randomUUID } from "node:crypto";
import {
  LIMITS,
  PHASE_DURATIONS,
  REACTIONS,
  type Ack,
  type ChatMessageView,
  type Phase,
  type PlayerView,
  type Reaction,
  type RevealRow,
  type RoomListItem,
  type RoomState,
  type RoundSummary,
  type SpeechView,
  type StandingRow,
} from "@mun/shared";
import type {
  GameStore,
  PhaseDurationsMs,
  PickedAgenda,
  PlayerIdentity,
  RoomConfig,
  RoomTransport,
  RoundRecord,
} from "./types.js";

export const DEFAULT_DURATIONS: PhaseDurationsMs = {
  agenda: PHASE_DURATIONS.agenda * 1000,
  debate: PHASE_DURATIONS.debate * 1000,
  drafting: PHASE_DURATIONS.drafting * 1000,
  voting: PHASE_DURATIONS.voting * 1000,
  reveal: PHASE_DURATIONS.reveal * 1000,
  speakerGrace: 8000,
  lobbySeat: 20000,
};

interface Member {
  playerId: string;
  userId: string;
  displayName: string;
  imageUrl: string | null;
  joinedAt: number;
  isReady: boolean;
  hasLeft: boolean;
  sockets: Set<string>;
  delegation: string | null;
  roundWins: number;
  votesReceived: number;
  zeroVoteRounds: number;
  seatTimer?: NodeJS.Timeout;
}

interface SpeechState {
  playerId: string;
  displayName: string;
  delegation: string | null;
  order: number;
  text: string;
  reactions: Record<Reaction, number>;
  reactedBy: Set<string>; // `${userId}:${reaction}`
  poi: { fromName: string; text: string } | null;
  done: boolean;
}

export interface RoundState {
  id: string;
  number: number;
  agenda: PickedAgenda;
  speakingOrder: string[];
  speakerIndex: number;
  speeches: Map<string, SpeechState>;
  poiUsedBy: Set<string>;
  resolutions: Map<string, { id: string; text: string }>; // playerId -> resolution
  votes: Map<string, string>; // voter playerId -> resolution id
  reveal: RevealRow[];
  twistShown: boolean;
  winnerPlayerIds: string[];
}

/** Everything the coaching step needs once a game ends. */
export interface FinishedGame {
  roomId: string;
  roomName: string;
  players: { userId: string; playerId: string; displayName: string; isWinner: boolean }[];
  rounds: RoundState[];
}

export interface GameRoomOptions {
  store: GameStore;
  transport: RoomTransport;
  durations?: Partial<PhaseDurationsMs>;
  minPlayersForRanked: number;
  onChange?: (room: GameRoom) => void;
  onFinished?: (game: FinishedGame) => void;
  random?: () => number;
}

const ok = <T>(data?: T): Ack<T> => ({ ok: true, data });
const fail = (error: string): Ack<never> => ({ ok: false, error });

const clean = (text: unknown, max: number) =>
  typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * One live room. The server is the single source of truth for phases and timers:
 * clients only send intents (speak, vote, ...) and render the state they are sent.
 */
export class GameRoom {
  readonly config: RoomConfig;
  phase: Phase = "lobby";
  phaseEndsAt: number | null = null;
  ranked = false;
  destroyed = false;
  lastActivity = Date.now();

  private hostUserId: string;
  private members = new Map<string, Member>(); // by playerId
  private round: RoundState | null = null;
  private rounds: RoundState[] = [];
  private history: RoundSummary[] = [];
  private standings: StandingRow[] = [];
  private chat: ChatMessageView[] = [];
  private usedAgendaIds: string[] = [];
  private timer: NodeJS.Timeout | null = null;
  private graceTimer: NodeJS.Timeout | null = null;
  private epoch = 0; // bumps on every phase change so stale async work can bail out
  private chatRate = new Map<string, number>();
  private readonly durations: PhaseDurationsMs;
  private readonly random: () => number;

  constructor(
    config: RoomConfig,
    private readonly opts: GameRoomOptions,
  ) {
    this.config = config;
    this.hostUserId = config.hostUserId;
    this.durations = { ...DEFAULT_DURATIONS, ...opts.durations };
    this.random = opts.random ?? Math.random;
  }

  // ---------------------------------------------------------------- queries

  get code() {
    return this.config.code;
  }

  get activeMembers() {
    return [...this.members.values()].filter((m) => !m.hasLeft);
  }

  get connectedMembers() {
    return this.activeMembers.filter((m) => m.sockets.size > 0);
  }

  hasUser(userId: string) {
    return !!this.memberByUser(userId);
  }

  hasSocket(socketId: string) {
    return [...this.members.values()].some((m) => m.sockets.has(socketId));
  }

  isEmpty() {
    return this.connectedMembers.length === 0;
  }

  listing(): RoomListItem | null {
    if (this.config.visibility !== "public" || this.phase !== "lobby") return null;
    const players = this.activeMembers.length;
    if (players >= this.config.maxPlayers || players === 0) return null;
    return {
      code: this.config.code,
      name: this.config.name,
      hostName: this.memberByUser(this.hostUserId)?.displayName ?? "Host",
      players,
      maxPlayers: this.config.maxPlayers,
      roundsTotal: this.config.roundsTotal,
      agendaMode: this.config.agendaMode,
      category: this.config.category,
    };
  }

  private memberByUser(userId: string) {
    return [...this.members.values()].find((m) => m.userId === userId);
  }

  private memberBySocket(socketId: string) {
    return [...this.members.values()].find((m) => m.sockets.has(socketId));
  }

  // ---------------------------------------------------------------- membership

  async join(user: PlayerIdentity, socketId: string): Promise<Ack> {
    if (this.destroyed) return fail("This room has closed.");
    this.lastActivity = Date.now();

    const existing = this.memberByUser(user.id);
    if (existing && !(existing.hasLeft && this.phase === "lobby")) {
      const wasOffline = existing.sockets.size === 0;
      existing.sockets.add(socketId);
      if (existing.seatTimer) clearTimeout(existing.seatTimer);
      existing.seatTimer = undefined;
      if (existing.hasLeft) existing.hasLeft = false;
      if (wasOffline && this.phase !== "lobby") this.system(`${existing.displayName} reconnected.`);
      this.sendChatHistory(socketId);
      this.changed();
      return ok();
    }

    if (this.phase !== "lobby") return fail("This game has already started.");
    if (this.activeMembers.length >= this.config.maxPlayers) return fail("This room is full.");

    const playerId = await this.opts.store.upsertPlayer(this.config.id, user);
    if (this.destroyed) return fail("This room has closed.");
    // A second tab may have joined while we were writing to the database.
    const raced = this.memberByUser(user.id);
    if (raced) {
      raced.sockets.add(socketId);
      raced.hasLeft = false;
      this.sendChatHistory(socketId);
      this.changed();
      return ok();
    }

    this.members.set(playerId, {
      playerId,
      userId: user.id,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
      joinedAt: Date.now(),
      isReady: user.id === this.hostUserId,
      hasLeft: false,
      sockets: new Set([socketId]),
      delegation: null,
      roundWins: 0,
      votesReceived: 0,
      zeroVoteRounds: 0,
    });
    this.sendChatHistory(socketId);
    this.system(`${user.displayName} joined the room.`);
    this.changed();
    return ok();
  }

  /** A socket dropped (tab closed, network blip). The seat is kept for a short while. */
  disconnect(socketId: string) {
    const member = this.memberBySocket(socketId);
    if (!member) return;
    member.sockets.delete(socketId);
    if (member.sockets.size > 0) return;

    if (this.phase === "lobby") {
      member.seatTimer = setTimeout(() => {
        if (member.sockets.size === 0) this.removeMember(member, `${member.displayName} left the room.`);
      }, this.durations.lobbySeat);
    } else if (this.phase !== "finished") {
      this.system(`${member.displayName} lost connection.`);
      if (this.currentSpeakerId === member.playerId) this.scheduleSpeakerGrace(member.playerId);
      this.checkEarlyAdvance();
    }
    this.changed();
  }

  /** Explicit "leave room" from the player. */
  leave(socketId: string) {
    const member = this.memberBySocket(socketId);
    if (!member) return;
    member.sockets.clear();
    if (this.phase === "lobby") {
      this.removeMember(member, `${member.displayName} left the room.`);
      return;
    }
    member.hasLeft = this.phase !== "finished";
    if (member.hasLeft) {
      this.system(`${member.displayName} left the game.`);
      if (this.currentSpeakerId === member.playerId) this.nextSpeaker();
      this.checkEarlyAdvance();
    }
    this.changed();
  }

  private removeMember(member: Member, message: string) {
    if (member.seatTimer) clearTimeout(member.seatTimer);
    this.members.delete(member.playerId);
    void this.opts.store.removePlayer(member.playerId).catch(logError("removePlayer"));
    for (const socketId of member.sockets) this.opts.transport.emit([socketId], "room:kicked", null);
    if (member.userId === this.hostUserId) this.transferHost();
    if (this.members.size > 0) this.system(message);
    this.changed();
  }

  private transferHost() {
    const next = this.activeMembers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!next) return;
    this.hostUserId = next.userId;
    next.isReady = true;
    void this.opts.store.updateRoom(this.config.id, { hostId: next.userId }).catch(logError("updateRoom"));
    this.system(`${next.displayName} is now the host.`);
  }

  setReady(socketId: string, ready: boolean) {
    const member = this.memberBySocket(socketId);
    if (!member || this.phase !== "lobby") return;
    member.isReady = member.userId === this.hostUserId ? true : !!ready;
    this.changed();
  }

  kick(socketId: string, playerId: string) {
    const host = this.memberBySocket(socketId);
    if (!host || host.userId !== this.hostUserId || this.phase !== "lobby") return;
    const target = this.members.get(playerId);
    if (!target || target.userId === this.hostUserId) return;
    this.removeMember(target, `${target.displayName} was removed by the host.`);
  }

  isHostSocket(socketId: string) {
    return this.memberBySocket(socketId)?.userId === this.hostUserId;
  }

  // ---------------------------------------------------------------- chat

  sendChat(socketId: string, text: string) {
    const member = this.memberBySocket(socketId);
    const body = clean(text, LIMITS.chat);
    if (!member || !body) return;
    const last = this.chatRate.get(member.userId) ?? 0;
    if (Date.now() - last < 400) return;
    this.chatRate.set(member.userId, Date.now());
    this.lastActivity = Date.now();
    this.pushChat({
      id: randomUUID(),
      kind: "chat",
      userId: member.userId,
      displayName: member.displayName,
      text: body,
      createdAt: Date.now(),
    });
  }

  private system(text: string) {
    this.pushChat({ id: randomUUID(), kind: "system", userId: null, displayName: "Chair", text, createdAt: Date.now() });
  }

  private pushChat(message: ChatMessageView) {
    this.chat.push(message);
    if (this.chat.length > 150) this.chat.splice(0, this.chat.length - 150);
    this.broadcast("chat:message", message);
    void this.opts.store.saveChat(this.config.id, message).catch(logError("saveChat"));
  }

  private sendChatHistory(socketId: string) {
    this.opts.transport.emit([socketId], "chat:history", this.chat);
  }

  // ---------------------------------------------------------------- game flow

  async start(socketId: string): Promise<Ack> {
    if (!this.isHostSocket(socketId)) return fail("Only the host can start the game.");
    if (this.phase !== "lobby") return fail("The game has already started.");
    const players = this.connectedMembers;
    if (players.length < LIMITS.minPlayers) return fail(`You need at least ${LIMITS.minPlayers} delegates to start.`);
    const notReady = players.filter((m) => !m.isReady);
    if (notReady.length) return fail(`Waiting for ${notReady.map((m) => m.displayName).join(", ")} to ready up.`);

    // Seats of anyone who disconnected in the lobby are released now.
    for (const m of this.activeMembers) if (m.sockets.size === 0) this.removeMember(m, `${m.displayName} left the room.`);

    this.ranked = this.activeMembers.length >= this.opts.minPlayersForRanked;
    void this.opts.store
      .updateRoom(this.config.id, { status: "in_progress", ranked: this.ranked, startedAt: new Date() })
      .catch(logError("updateRoom"));
    this.system(
      this.ranked
        ? "Session opened. This game counts toward the global leaderboard."
        : `Session opened. Unranked game - ${this.opts.minPlayersForRanked}+ delegates are needed for leaderboard points.`,
    );
    await this.startRound(1);
    return ok();
  }

  private async startRound(number: number) {
    const epoch = ++this.epoch;
    this.clearTimers();
    let agenda: PickedAgenda;
    let roundId: string;
    try {
      agenda = await this.opts.store.pickAgenda({
        category: this.config.category,
        excludeIds: this.usedAgendaIds,
        customText: this.config.agendaMode === "custom" ? (this.config.customAgendas[number - 1] ?? null) : null,
        createdById: this.hostUserId,
      });
      roundId = await this.opts.store.createRound(this.config.id, number, agenda.id);
    } catch (err) {
      logError("startRound")(err);
      this.system("The chair could not load an agenda. Ending the session.");
      this.finish();
      return;
    }
    if (this.destroyed || epoch !== this.epoch) return;
    this.usedAgendaIds.push(agenda.id);

    const players = this.shuffle(this.activeMembers.filter((m) => m.sockets.size > 0));
    const roles = this.shuffle(agenda.stakeholders);
    players.forEach((m, i) => {
      m.delegation = roles[i % Math.max(roles.length, 1)] ?? null;
      if (i >= roles.length && roles.length) m.delegation = `${roles[i % roles.length]} (co-delegate)`;
    });

    this.round = {
      id: roundId,
      number,
      agenda,
      speakingOrder: players.map((m) => m.playerId),
      speakerIndex: -1,
      speeches: new Map(),
      poiUsedBy: new Set(),
      resolutions: new Map(),
      votes: new Map(),
      reveal: [],
      twistShown: false,
      winnerPlayerIds: [],
    };
    this.rounds.push(this.round);
    this.system(`Round ${number} of ${this.config.roundsTotal}: "${agenda.title}"`);
    this.setPhase("agenda", this.durations.agenda, () => this.nextSpeaker());
  }

  get currentSpeakerId(): string | null {
    if (this.phase !== "debate" || !this.round) return null;
    return this.round.speakingOrder[this.round.speakerIndex] ?? null;
  }

  private nextSpeaker() {
    const round = this.round;
    if (!round) return;
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = null;

    const previous = this.currentSpeakerId;
    if (previous) {
      const speech = round.speeches.get(previous);
      if (speech) speech.done = true;
    }

    // Advance to the next speaker who is still in the room.
    do {
      round.speakerIndex++;
    } while (
      round.speakerIndex < round.speakingOrder.length &&
      !this.isConnected(round.speakingOrder[round.speakerIndex]!)
    );

    const speakerId = round.speakingOrder[round.speakerIndex];
    if (!speakerId) {
      this.beginDrafting();
      return;
    }
    const speaker = this.members.get(speakerId)!;
    round.speeches.set(speakerId, {
      playerId: speakerId,
      displayName: speaker.displayName,
      delegation: speaker.delegation,
      order: round.speakerIndex,
      text: "",
      reactions: { agree: 0, disagree: 0, applause: 0 },
      reactedBy: new Set(),
      poi: null,
      done: false,
    });
    this.phase = "debate"; // so currentSpeakerId resolves for the announcement
    this.system(`The floor recognises ${speaker.displayName}${speaker.delegation ? ` (${speaker.delegation})` : ""}.`);
    this.setPhase("debate", this.durations.debate, () => this.nextSpeaker());
  }

  private scheduleSpeakerGrace(playerId: string) {
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = setTimeout(() => {
      if (this.currentSpeakerId === playerId && !this.isConnected(playerId)) {
        this.system("The speaker is unreachable. Moving to the next delegate.");
        this.nextSpeaker();
      }
    }, this.durations.speakerGrace);
  }

  private isConnected(playerId: string) {
    const m = this.members.get(playerId);
    return !!m && !m.hasLeft && m.sockets.size > 0;
  }

  updateSpeech(socketId: string, text: string) {
    const member = this.memberBySocket(socketId);
    if (!member || !this.round || this.currentSpeakerId !== member.playerId) return;
    const speech = this.round.speeches.get(member.playerId);
    if (!speech) return;
    speech.text = typeof text === "string" ? text.slice(0, LIMITS.speech) : "";
    this.lastActivity = Date.now();
    const others = this.activeMembers.filter((m) => m !== member).flatMap((m) => [...m.sockets]);
    this.opts.transport.emit(others, "speech:live", { playerId: member.playerId, text: speech.text });
  }

  yieldFloor(socketId: string) {
    const member = this.memberBySocket(socketId);
    if (!member || this.currentSpeakerId !== member.playerId) return;
    this.system(`${member.displayName} yields the floor.`);
    this.nextSpeaker();
  }

  react(socketId: string, playerId: string, reaction: Reaction) {
    const member = this.memberBySocket(socketId);
    if (!member || !this.round || this.phase !== "debate" || !REACTIONS.includes(reaction)) return;
    if (member.playerId === playerId) return;
    const speech = this.round.speeches.get(playerId);
    if (!speech) return;
    const key = `${member.userId}:${reaction}`;
    if (speech.reactedBy.has(key)) {
      speech.reactedBy.delete(key);
      speech.reactions[reaction] = Math.max(0, speech.reactions[reaction] - 1);
    } else {
      speech.reactedBy.add(key);
      speech.reactions[reaction]++;
    }
    this.changed();
  }

  raisePoi(socketId: string, text: string) {
    const member = this.memberBySocket(socketId);
    const body = clean(text, LIMITS.poi);
    const speakerId = this.currentSpeakerId;
    if (!member || !this.round || !speakerId || !body) return;
    if (member.playerId === speakerId || this.round.poiUsedBy.has(member.playerId)) return;
    const speech = this.round.speeches.get(speakerId);
    if (!speech || speech.poi) {
      this.opts.transport.emit(member.sockets, "toast", { kind: "error", message: "This speaker already took a point of information." });
      return;
    }
    this.round.poiUsedBy.add(member.playerId);
    speech.poi = { fromName: `${member.displayName}${member.delegation ? ` (${member.delegation})` : ""}`, text: body };
    this.system(`Point of information from ${member.displayName}.`);
    this.changed();
  }

  private beginDrafting() {
    const round = this.round;
    if (!round) return;
    round.twistShown = !!round.agenda.twist;
    if (round.agenda.twist) this.system(`CRISIS UPDATE: ${round.agenda.twist}`);
    this.system("Drafting open. Submit a one-line resolution.");
    this.setPhase("drafting", this.durations.drafting, () => this.beginVoting());
  }

  submitResolution(socketId: string, text: string): Ack {
    const member = this.memberBySocket(socketId);
    const body = clean(text, LIMITS.resolution);
    if (!member || !this.round) return fail("You are not in this game.");
    if (this.phase !== "drafting") return fail("Drafting is closed.");
    if (body.length < 8) return fail("Write at least a few words.");
    const existing = this.round.resolutions.get(member.playerId);
    this.round.resolutions.set(member.playerId, { id: existing?.id ?? randomUUID(), text: body });
    this.changed();
    this.checkEarlyAdvance();
    return ok();
  }

  private beginVoting() {
    const round = this.round;
    if (!round) return;
    if (round.resolutions.size === 0) {
      this.system("No resolutions were submitted this round.");
      this.beginReveal();
      return;
    }
    this.system("Voting is open. Resolutions are anonymous - you cannot vote for your own.");
    this.setPhase("voting", this.durations.voting, () => this.beginReveal());
  }

  castVote(socketId: string, resolutionId: string): Ack {
    const member = this.memberBySocket(socketId);
    if (!member || !this.round) return fail("You are not in this game.");
    if (this.phase !== "voting") return fail("Voting is closed.");
    const target = [...this.round.resolutions.entries()].find(([, r]) => r.id === resolutionId);
    if (!target) return fail("That resolution no longer exists.");
    if (target[0] === member.playerId) return fail("You cannot vote for your own resolution.");
    this.round.votes.set(member.playerId, resolutionId);
    this.changed();
    this.checkEarlyAdvance();
    return ok();
  }

  private eligibleVoters(round: RoundState) {
    return this.connectedMembers.filter((m) =>
      [...round.resolutions.keys()].some((authorId) => authorId !== m.playerId),
    );
  }

  /** Skip the rest of a timer once everyone still connected has acted. */
  private checkEarlyAdvance() {
    const round = this.round;
    if (!round) return;
    if (this.phase === "drafting") {
      const connected = this.connectedMembers;
      if (connected.length > 0 && connected.every((m) => round.resolutions.has(m.playerId))) {
        this.system("All resolutions are in.");
        this.beginVoting();
      }
    } else if (this.phase === "voting") {
      const voters = this.eligibleVoters(round);
      if (voters.length === 0 || voters.every((m) => round.votes.has(m.playerId))) this.beginReveal();
    }
  }

  private beginReveal() {
    const round = this.round;
    if (!round) return;

    const tally = new Map<string, number>();
    for (const resolutionId of round.votes.values()) tally.set(resolutionId, (tally.get(resolutionId) ?? 0) + 1);
    const top = Math.max(0, ...tally.values());

    const rows: RevealRow[] = [...round.resolutions.entries()].map(([playerId, r]) => {
      const m = this.members.get(playerId);
      const votes = tally.get(r.id) ?? 0;
      return {
        resolutionId: r.id,
        text: r.text,
        playerId,
        displayName: m?.displayName ?? "Delegate",
        delegation: m?.delegation ?? null,
        votes,
        isWinner: top > 0 && votes === top,
      };
    });
    rows.sort((a, b) => b.votes - a.votes);
    round.reveal = rows;
    round.winnerPlayerIds = rows.filter((r) => r.isWinner).map((r) => r.playerId);

    for (const m of this.members.values()) {
      if (!round.speakingOrder.includes(m.playerId) && !round.resolutions.has(m.playerId)) continue;
      const row = rows.find((r) => r.playerId === m.playerId);
      m.votesReceived += row?.votes ?? 0;
      if (!row || row.votes === 0) m.zeroVoteRounds++;
      if (row?.isWinner) m.roundWins++;
    }

    const winnerNames = rows.filter((r) => r.isWinner).map((r) => r.displayName);
    this.history.push({ number: round.number, agendaTitle: round.agenda.title, winnerNames });
    this.system(
      winnerNames.length
        ? `Round ${round.number} goes to ${winnerNames.join(" & ")}.`
        : `Round ${round.number} ends without a winning resolution.`,
    );

    void this.opts.store.saveRound(this.roundRecord(round, rows)).catch(logError("saveRound"));

    const isLast = round.number >= this.config.roundsTotal;
    this.setPhase("reveal", this.durations.reveal, () => {
      if (isLast) this.finish();
      else void this.startRound(round.number + 1);
    });
  }

  private roundRecord(round: RoundState, rows: RevealRow[]): RoundRecord {
    return {
      roundId: round.id,
      winnerPlayerIds: round.winnerPlayerIds,
      speeches: [...round.speeches.values()].map((s) => ({
        playerId: s.playerId,
        displayName: s.displayName,
        delegation: s.delegation,
        order: s.order,
        text: s.text,
        agree: s.reactions.agree,
        disagree: s.reactions.disagree,
        applause: s.reactions.applause,
        poiText: s.poi?.text ?? null,
        poiFromName: s.poi?.fromName ?? null,
      })),
      resolutions: rows.map((r) => ({
        id: r.resolutionId,
        playerId: r.playerId,
        displayName: r.displayName,
        text: r.text,
        votes: r.votes,
        isWinner: r.isWinner,
      })),
      votes: [...round.votes.entries()].map(([voterPlayerId, resolutionId]) => ({ voterPlayerId, resolutionId })),
    };
  }

  private finish() {
    this.clearTimers();
    this.epoch++;
    const players = [...this.members.values()].filter((m) => this.rounds.some((r) => r.speakingOrder.includes(m.playerId)));

    // Most round wins, then most votes received, then fewest rounds with zero votes.
    const ranked = [...players].sort(
      (a, b) => b.roundWins - a.roundWins || b.votesReceived - a.votesReceived || a.zeroVoteRounds - b.zeroVoteRounds,
    );
    const best = ranked[0];
    const isTop = (m: Member) =>
      !!best &&
      best.roundWins > 0 &&
      m.roundWins === best.roundWins &&
      m.votesReceived === best.votesReceived &&
      m.zeroVoteRounds === best.zeroVoteRounds;

    this.standings = ranked.map((m) => ({
      playerId: m.playerId,
      userId: m.userId,
      displayName: m.displayName,
      roundWins: m.roundWins,
      votesReceived: m.votesReceived,
      zeroVoteRounds: m.zeroVoteRounds,
      isWinner: isTop(m),
    }));

    this.phase = "finished";
    this.phaseEndsAt = null;
    const winners = this.standings.filter((s) => s.isWinner).map((s) => s.displayName);
    this.system(winners.length ? `Session closed. ${winners.join(" & ")} wins the room!` : "Session closed. No winner this time.");

    void this.opts.store
      .finishGame({
        roomId: this.config.id,
        ranked: this.ranked,
        players: this.standings.map((s) => ({
          playerId: s.playerId,
          userId: s.userId,
          roundWins: s.roundWins,
          votesReceived: s.votesReceived,
          zeroVoteRounds: s.zeroVoteRounds,
          isWinner: s.isWinner,
        })),
      })
      .catch(logError("finishGame"));

    this.opts.onFinished?.({
      roomId: this.config.id,
      roomName: this.config.name,
      players: this.standings.map((s) => ({
        userId: s.userId,
        playerId: s.playerId,
        displayName: s.displayName,
        isWinner: s.isWinner,
      })),
      rounds: this.rounds,
    });
    this.changed();
  }

  // ---------------------------------------------------------------- plumbing

  private setPhase(phase: Phase, durationMs: number, onTimeout: () => void) {
    if (this.timer) clearTimeout(this.timer);
    const epoch = ++this.epoch;
    this.phase = phase;
    this.phaseEndsAt = Date.now() + durationMs;
    this.timer = setTimeout(() => {
      if (this.destroyed || epoch !== this.epoch) return;
      onTimeout();
    }, durationMs);
    this.changed();
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.timer = null;
    this.graceTimer = null;
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    for (const m of this.members.values()) if (m.seatTimer) clearTimeout(m.seatTimer);
  }

  /** Recompute and push a personalised snapshot to every connected socket. */
  private changed() {
    this.lastActivity = Date.now();
    for (const m of this.members.values()) {
      if (m.sockets.size === 0) continue;
      this.opts.transport.emit(m.sockets, "room:state", this.stateFor(m));
    }
    this.opts.onChange?.(this);
  }

  broadcast(event: string, payload: unknown) {
    this.opts.transport.emit(
      [...this.members.values()].flatMap((m) => [...m.sockets]),
      event,
      payload,
    );
  }

  /** Sends a payload to every socket a given user has open in this room. */
  sendToUser(userId: string, event: string, payload: unknown) {
    const m = this.memberByUser(userId);
    if (m) this.opts.transport.emit(m.sockets, event, payload);
  }

  stateForSocket(socketId: string): RoomState | null {
    const m = this.memberBySocket(socketId);
    return m ? this.stateFor(m) : null;
  }

  private stateFor(me: Member): RoomState {
    const round = this.round;
    const players: PlayerView[] = this.activeMembers
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({
        id: m.playerId,
        userId: m.userId,
        displayName: m.displayName,
        imageUrl: m.imageUrl,
        delegation: m.delegation,
        isHost: m.userId === this.hostUserId,
        isReady: m.isReady,
        isConnected: m.sockets.size > 0,
        roundWins: m.roundWins,
        votesReceived: m.votesReceived,
      }));

    const speeches: SpeechView[] = round
      ? [...round.speeches.values()]
          .sort((a, b) => a.order - b.order)
          .map((s) => ({
            playerId: s.playerId,
            displayName: s.displayName,
            delegation: s.delegation,
            text: s.text,
            reactions: { ...s.reactions },
            myReactions: REACTIONS.filter((r) => s.reactedBy.has(`${me.userId}:${r}`)),
            poi: s.poi,
            done: s.done,
          }))
      : [];

    const showResolutions = this.phase === "voting";
    // Shuffle per viewer (stable for the round) so position cannot reveal the author.
    const resolutions = showResolutions && round
      ? [...round.resolutions.entries()]
          .map(([playerId, r]) => ({ id: r.id, text: r.text, isMine: playerId === me.playerId }))
          .sort((a, b) => hash(a.id + me.userId) - hash(b.id + me.userId))
      : [];

    return {
      id: this.config.id,
      code: this.config.code,
      name: this.config.name,
      visibility: this.config.visibility,
      agendaMode: this.config.agendaMode,
      category: this.config.category,
      roundsTotal: this.config.roundsTotal,
      maxPlayers: this.config.maxPlayers,
      ranked: this.ranked,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      roundNumber: round?.number ?? 0,
      agenda: round
        ? {
            id: round.agenda.id,
            title: round.agenda.title,
            brief: round.agenda.brief,
            category: round.agenda.category,
            twist: round.twistShown ? round.agenda.twist : null,
          }
        : null,
      twistShown: round?.twistShown ?? false,
      players,
      me: { playerId: me.playerId, isHost: me.userId === this.hostUserId },
      speakingOrder: round?.speakingOrder ?? [],
      currentSpeakerId: this.currentSpeakerId,
      speeches,
      myPoiUsed: !!round?.poiUsedBy.has(me.playerId),
      submittedPlayerIds: round && ["drafting", "voting"].includes(this.phase) ? [...round.resolutions.keys()] : [],
      myResolution: round?.resolutions.get(me.playerId)?.text ?? null,
      resolutions,
      votedPlayerIds: round && this.phase === "voting" ? [...round.votes.keys()] : [],
      myVote: round?.votes.get(me.playerId) ?? null,
      reveal: round && (this.phase === "reveal" || this.phase === "finished") ? round.reveal : [],
      history: this.history,
      standings: this.phase === "finished" ? this.standings : [],
    };
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function logError(where: string) {
  return (err: unknown) => console.error(`[game:${where}]`, err);
}
