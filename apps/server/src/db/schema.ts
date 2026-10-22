import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Mirrors a Clerk user. `id` is the Clerk user id. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  imageUrl: text("image_url"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const playerStats = pgTable(
  "player_stats",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    roundsWon: integer("rounds_won").notNull().default(0),
    votesReceived: integer("votes_received").notNull().default(0),
    zeroVoteRounds: integer("zero_vote_rounds").notNull().default(0),
    points: integer("points").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("player_stats_points_idx").on(t.points)],
);

export const agendas = pgTable(
  "agendas",
  {
    id: id(),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    category: text("category").notNull(),
    stakeholders: text("stakeholders").array().notNull().default([]),
    twist: text("twist"),
    status: text("status").notNull().default("active"), // active | archived
    isCustom: boolean("is_custom").notNull().default(false),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("agendas_status_category_idx").on(t.status, t.category)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    hostId: text("host_id").notNull(),
    visibility: text("visibility").notNull().default("public"), // public | private
    agendaMode: text("agenda_mode").notNull().default("random"), // random | custom
    category: text("category"),
    customAgendas: text("custom_agendas").array().notNull().default([]),
    roundsTotal: integer("rounds_total").notNull().default(3),
    maxPlayers: integer("max_players").notNull().default(8),
    status: text("status").notNull().default("lobby"), // lobby | in_progress | finished | abandoned
    ranked: boolean("ranked").notNull().default(false),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("rooms_status_visibility_idx").on(t.status, t.visibility)],
);

export const roomPlayers = pgTable(
  "room_players",
  {
    id: id(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    imageUrl: text("image_url"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    roundWins: integer("round_wins").notNull().default(0),
    votesReceived: integer("votes_received").notNull().default(0),
    zeroVoteRounds: integer("zero_vote_rounds").notNull().default(0),
    isWinner: boolean("is_winner").notNull().default(false),
  },
  (t) => [uniqueIndex("room_players_room_user_uq").on(t.roomId, t.userId), index("room_players_user_idx").on(t.userId)],
);

export const rounds = pgTable(
  "rounds",
  {
    id: id(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    agendaId: text("agenda_id")
      .notNull()
      .references(() => agendas.id),
    winnerPlayerIds: text("winner_player_ids").array().notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("rounds_room_number_uq").on(t.roomId, t.number)],
);

export const speeches = pgTable(
  "speeches",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    displayName: text("display_name").notNull(),
    delegation: text("delegation"),
    order: integer("order").notNull(),
    text: text("text").notNull(),
    agree: integer("agree").notNull().default(0),
    disagree: integer("disagree").notNull().default(0),
    applause: integer("applause").notNull().default(0),
    poiText: text("poi_text"),
    poiFromName: text("poi_from_name"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("speeches_round_player_uq").on(t.roundId, t.playerId)],
);

export const resolutions = pgTable(
  "resolutions",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    displayName: text("display_name").notNull(),
    text: text("text").notNull(),
    votes: integer("votes").notNull().default(0),
    isWinner: boolean("is_winner").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("resolutions_round_player_uq").on(t.roundId, t.playerId)],
);

export const votes = pgTable(
  "votes",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    voterPlayerId: text("voter_player_id").notNull(),
    resolutionId: text("resolution_id").notNull(),
    createdAt: createdAt(),
  },
  // One vote per player per round, enforced by the database.
  (t) => [uniqueIndex("votes_round_voter_uq").on(t.roundId, t.voterPlayerId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    displayName: text("display_name").notNull(),
    kind: text("kind").notNull().default("chat"), // chat | system
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_messages_room_created_idx").on(t.roomId, t.createdAt)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    clarity: integer("clarity").notNull(),
    relevance: integer("relevance").notNull(),
    persuasiveness: integer("persuasiveness").notNull(),
    conciseness: integer("conciseness").notNull(),
    advice: jsonb("advice").$type<Record<"clarity" | "relevance" | "persuasiveness" | "conciseness", string>>().notNull(),
    bestLine: text("best_line"),
    summary: text("summary").notNull(),
    source: text("source").notNull().default("rules"), // ai | rules
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feedback_room_user_uq").on(t.roomId, t.userId), index("feedback_user_idx").on(t.userId)],
);

export const dailyCrises = pgTable("daily_crises", {
  id: id(),
  date: text("date").notNull().unique(), // YYYY-MM-DD (UTC)
  agendaId: text("agenda_id")
    .notNull()
    .references(() => agendas.id),
});

export const dailyEntries = pgTable(
  "daily_entries",
  {
    id: id(),
    dailyCrisisId: text("daily_crisis_id")
      .notNull()
      .references(() => dailyCrises.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("daily_entries_crisis_user_uq").on(t.dailyCrisisId, t.userId)],
);

export const dailyVotes = pgTable(
  "daily_votes",
  {
    id: id(),
    dailyCrisisId: text("daily_crisis_id")
      .notNull()
      .references(() => dailyCrises.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => dailyEntries.id, { onDelete: "cascade" }),
    voterId: text("voter_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("daily_votes_crisis_voter_uq").on(t.dailyCrisisId, t.voterId)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: text("reporter_id").notNull(),
    targetType: text("target_type").notNull(), // resolution | chat | daily_entry | speech
    targetId: text("target_id").notNull(),
    targetText: text("target_text").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"), // open | resolved
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

// ---- relations (for db.query.* nested reads) ----

export const roomsRelations = relations(rooms, ({ many }) => ({
  players: many(roomPlayers),
  rounds: many(rounds),
}));

export const roomPlayersRelations = relations(roomPlayers, ({ one }) => ({
  room: one(rooms, { fields: [roomPlayers.roomId], references: [rooms.id] }),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  room: one(rooms, { fields: [rounds.roomId], references: [rooms.id] }),
  agenda: one(agendas, { fields: [rounds.agendaId], references: [agendas.id] }),
  speeches: many(speeches),
  resolutions: many(resolutions),
}));

export const speechesRelations = relations(speeches, ({ one }) => ({
  round: one(rounds, { fields: [speeches.roundId], references: [rounds.id] }),
}));

export const resolutionsRelations = relations(resolutions, ({ one }) => ({
  round: one(rounds, { fields: [resolutions.roundId], references: [rounds.id] }),
}));

export const dailyCrisesRelations = relations(dailyCrises, ({ one, many }) => ({
  agenda: one(agendas, { fields: [dailyCrises.agendaId], references: [agendas.id] }),
  entries: many(dailyEntries),
}));

export const dailyEntriesRelations = relations(dailyEntries, ({ one, many }) => ({
  crisis: one(dailyCrises, { fields: [dailyEntries.dailyCrisisId], references: [dailyCrises.id] }),
  votes: many(dailyVotes),
}));

export const dailyVotesRelations = relations(dailyVotes, ({ one }) => ({
  entry: one(dailyEntries, { fields: [dailyVotes.entryId], references: [dailyEntries.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  stats: one(playerStats, { fields: [users.id], references: [playerStats.userId] }),
}));
