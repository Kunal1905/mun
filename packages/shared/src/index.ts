// Shared contract between the game server and the web client.
// Anything both sides must agree on (phases, limits, payload shapes) lives here.

export const PHASE_DURATIONS = {
  agenda: 12,
  debate: 60,
  drafting: 90,
  voting: 45,
  reveal: 15,
} as const;

export const LIMITS = {
  speech: 1200,
  resolution: 160,
  chat: 300,
  poi: 140,
  roomName: 48,
  displayName: 32,
  customAgenda: 200,
  reportReason: 300,
  minRounds: 1,
  maxRounds: 5,
  minPlayers: 2,
  maxPlayers: 10,
} as const;

/** Points added to the global leaderboard. */
export const SCORING = {
  roundWin: 1,
  gameWin: 3,
} as const;

export type Phase = "lobby" | "agenda" | "debate" | "drafting" | "voting" | "reveal" | "finished";
export type GamePhase = Exclude<Phase, "lobby" | "finished">;
export type Visibility = "public" | "private";
export type AgendaMode = "random" | "custom";
export type Reaction = "agree" | "disagree" | "applause";

export const REACTIONS: Reaction[] = ["agree", "disagree", "applause"];

export const AGENDA_CATEGORIES = [
  "security",
  "climate",
  "economy",
  "health",
  "technology",
  "human-rights",
  "migration",
] as const;
export type AgendaCategory = (typeof AGENDA_CATEGORIES)[number];

export interface AgendaView {
  id: string;
  title: string;
  brief: string;
  category: string;
  twist: string | null;
}

export interface PlayerView {
  id: string; // RoomPlayer id
  userId: string;
  displayName: string;
  imageUrl: string | null;
  delegation: string | null;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  roundWins: number;
  votesReceived: number;
}

export interface SpeechView {
  playerId: string;
  displayName: string;
  delegation: string | null;
  text: string;
  reactions: Record<Reaction, number>;
  myReactions: Reaction[];
  poi: { fromName: string; text: string } | null;
  done: boolean;
}

export interface ResolutionView {
  id: string;
  text: string;
  isMine: boolean;
}

export interface RevealRow {
  resolutionId: string;
  text: string;
  playerId: string;
  displayName: string;
  delegation: string | null;
  votes: number;
  isWinner: boolean;
}

export interface RoundSummary {
  number: number;
  agendaTitle: string;
  winnerNames: string[];
}

export interface StandingRow {
  playerId: string;
  userId: string;
  displayName: string;
  roundWins: number;
  votesReceived: number;
  zeroVoteRounds: number;
  isWinner: boolean;
}

export interface ChatMessageView {
  id: string;
  kind: "chat" | "system";
  userId: string | null;
  displayName: string;
  text: string;
  createdAt: number;
}

/** Personalised snapshot of a room, sent to each socket on every change. */
export interface RoomState {
  id: string;
  code: string;
  name: string;
  visibility: Visibility;
  agendaMode: AgendaMode;
  category: string | null;
  roundsTotal: number;
  maxPlayers: number;
  ranked: boolean;

  phase: Phase;
  phaseEndsAt: number | null;
  serverNow: number;

  roundNumber: number;
  agenda: AgendaView | null;
  twistShown: boolean;

  players: PlayerView[];
  me: { playerId: string; isHost: boolean } | null;

  speakingOrder: string[];
  currentSpeakerId: string | null;
  speeches: SpeechView[];
  myPoiUsed: boolean;

  submittedPlayerIds: string[];
  myResolution: string | null;

  resolutions: ResolutionView[]; // anonymous, during voting
  votedPlayerIds: string[];
  myVote: string | null;

  reveal: RevealRow[]; // during reveal / finished (last round)
  history: RoundSummary[];
  standings: StandingRow[]; // when finished
}

export interface RoomListItem {
  code: string;
  name: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  roundsTotal: number;
  agendaMode: AgendaMode;
  category: string | null;
}

export interface FeedbackView {
  id: string;
  roomId: string;
  roomName: string;
  clarity: number;
  relevance: number;
  persuasiveness: number;
  conciseness: number;
  advice: Record<"clarity" | "relevance" | "persuasiveness" | "conciseness", string>;
  bestLine: string | null;
  summary: string;
  source: "ai" | "rules";
  createdAt: string;
}

// ---- Socket.IO event maps ----

export interface ClientToServerEvents {
  "room:join": (payload: { code: string }, ack: (res: Ack) => void) => void;
  "room:leave": () => void;
  "room:ready": (payload: { ready: boolean }) => void;
  "room:start": (ack: (res: Ack) => void) => void;
  "room:kick": (payload: { playerId: string }) => void;
  "room:rematch": (ack: (res: Ack<{ code: string }>) => void) => void;
  "chat:send": (payload: { text: string }) => void;
  "speech:update": (payload: { text: string }) => void;
  "speech:yield": () => void;
  "speech:react": (payload: { playerId: string; reaction: Reaction }) => void;
  "speech:poi": (payload: { text: string }) => void;
  "resolution:submit": (payload: { text: string }, ack: (res: Ack) => void) => void;
  "vote:cast": (payload: { resolutionId: string }, ack: (res: Ack) => void) => void;
  "lobby:subscribe": () => void;
  "lobby:unsubscribe": () => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomState) => void;
  "room:kicked": () => void;
  "room:rematch": (payload: { code: string }) => void;
  "chat:history": (messages: ChatMessageView[]) => void;
  "chat:message": (message: ChatMessageView) => void;
  "speech:live": (payload: { playerId: string; text: string }) => void;
  "lobby:rooms": (rooms: RoomListItem[]) => void;
  "feedback:ready": (feedback: FeedbackView) => void;
  toast: (payload: { kind: "info" | "error"; message: string }) => void;
}

export type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
