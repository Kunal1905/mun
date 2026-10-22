import type { AgendaMode, AgendaView, ChatMessageView, Visibility } from "@mun/shared";

export interface RoomConfig {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  visibility: Visibility;
  agendaMode: AgendaMode;
  category: string | null;
  customAgendas: string[];
  roundsTotal: number;
  maxPlayers: number;
}

export interface PickedAgenda extends AgendaView {
  stakeholders: string[];
}

export interface PlayerIdentity {
  id: string; // user id
  displayName: string;
  imageUrl: string | null;
}

export interface SpeechRecord {
  playerId: string;
  displayName: string;
  delegation: string | null;
  order: number;
  text: string;
  agree: number;
  disagree: number;
  applause: number;
  poiText: string | null;
  poiFromName: string | null;
}

export interface ResolutionRecord {
  id: string;
  playerId: string;
  displayName: string;
  text: string;
  votes: number;
  isWinner: boolean;
}

export interface RoundRecord {
  roundId: string;
  speeches: SpeechRecord[];
  resolutions: ResolutionRecord[];
  votes: { voterPlayerId: string; resolutionId: string }[];
  winnerPlayerIds: string[];
}

export interface GameRecord {
  roomId: string;
  ranked: boolean;
  players: {
    playerId: string;
    userId: string;
    roundWins: number;
    votesReceived: number;
    zeroVoteRounds: number;
    isWinner: boolean;
  }[];
}

/** Persistence boundary for the engine, so game logic can be tested without a database. */
export interface GameStore {
  upsertPlayer(roomId: string, user: PlayerIdentity): Promise<string>;
  removePlayer(playerId: string): Promise<void>;
  updateRoom(
    roomId: string,
    data: Partial<{ hostId: string; status: string; ranked: boolean; startedAt: Date; finishedAt: Date }>,
  ): Promise<void>;
  pickAgenda(opts: {
    category: string | null;
    excludeIds: string[];
    customText: string | null;
    createdById: string;
  }): Promise<PickedAgenda>;
  createRound(roomId: string, number: number, agendaId: string): Promise<string>;
  saveRound(record: RoundRecord): Promise<void>;
  finishGame(record: GameRecord): Promise<void>;
  saveChat(roomId: string, message: ChatMessageView): Promise<void>;
}

/** Transport boundary: how the engine reaches connected sockets. */
export interface RoomTransport {
  emit(socketIds: Iterable<string>, event: string, payload: unknown): void;
}

export interface PhaseDurationsMs {
  agenda: number;
  debate: number;
  drafting: number;
  voting: number;
  reveal: number;
  /** Grace period before skipping a speaker whose connection dropped. */
  speakerGrace: number;
  /** How long a disconnected player keeps their lobby seat. */
  lobbySeat: number;
}
