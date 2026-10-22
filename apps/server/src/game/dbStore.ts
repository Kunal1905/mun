import { and, eq, notInArray, sql, type SQL } from "drizzle-orm";
import { LIMITS, SCORING } from "@mun/shared";
import { db } from "../db/index.js";
import {
  agendas,
  chatMessages,
  playerStats,
  resolutions,
  roomPlayers,
  rooms,
  rounds,
  speeches,
  votes,
} from "../db/schema.js";
import type { GameStore, PickedAgenda } from "./types.js";

const GENERIC_DELEGATIONS = [
  "United States",
  "China",
  "India",
  "European Union",
  "Brazil",
  "African Union",
  "Japan",
  "Russia",
  "Saudi Arabia",
  "Indonesia",
];

const toPicked = (a: typeof agendas.$inferSelect): PickedAgenda => ({
  id: a.id,
  title: a.title,
  brief: a.brief,
  category: a.category,
  twist: a.twist,
  stakeholders: a.stakeholders.length ? a.stakeholders : GENERIC_DELEGATIONS,
});

/** Picks a random row matching `where` without loading the whole pool. */
async function randomAgenda(where: SQL | undefined) {
  const [row] = await db.select().from(agendas).where(where).orderBy(sql`random()`).limit(1);
  return row;
}

export const dbStore: GameStore = {
  async upsertPlayer(roomId, user) {
    const [player] = await db
      .insert(roomPlayers)
      .values({ roomId, userId: user.id, displayName: user.displayName, imageUrl: user.imageUrl })
      .onConflictDoUpdate({
        target: [roomPlayers.roomId, roomPlayers.userId],
        set: { displayName: user.displayName, imageUrl: user.imageUrl },
      })
      .returning({ id: roomPlayers.id });
    return player!.id;
  },

  async removePlayer(playerId) {
    await db.delete(roomPlayers).where(eq(roomPlayers.id, playerId));
  },

  async updateRoom(roomId, data) {
    await db.update(rooms).set(data).where(eq(rooms.id, roomId));
  },

  async pickAgenda({ category, excludeIds, customText, createdById }) {
    if (customText?.trim()) {
      const [agenda] = await db
        .insert(agendas)
        .values({
          title: customText.trim().slice(0, LIMITS.customAgenda),
          brief: "A custom agenda set by the host. Argue it from your delegation's interests.",
          category: category ?? "custom",
          stakeholders: GENERIC_DELEGATIONS,
          status: "archived", // custom agendas never enter the random pool
          isCustom: true,
          createdById,
        })
        .returning();
      return toPicked(agenda!);
    }

    const pool = and(eq(agendas.status, "active"), eq(agendas.isCustom, false));
    const inCategory = category ? and(pool, eq(agendas.category, category)) : pool;
    const fresh = excludeIds.length ? and(inCategory, notInArray(agendas.id, excludeIds)) : inCategory;

    // Prefer an unused agenda in the category, then any in the category, then anything.
    const agenda = (await randomAgenda(fresh)) ?? (await randomAgenda(inCategory)) ?? (await randomAgenda(pool));
    if (!agenda) throw new Error("Agenda pool is empty. Run `npm run db:seed`.");
    return toPicked(agenda);
  },

  async createRound(roomId, number, agendaId) {
    const [round] = await db.insert(rounds).values({ roomId, number, agendaId }).returning({ id: rounds.id });
    return round!.id;
  },

  async saveRound(record) {
    await db.transaction(async (tx) => {
      if (record.speeches.length)
        await tx
          .insert(speeches)
          .values(record.speeches.map((s) => ({ ...s, roundId: record.roundId })))
          .onConflictDoNothing();
      if (record.resolutions.length)
        await tx
          .insert(resolutions)
          .values(record.resolutions.map((r) => ({ ...r, roundId: record.roundId })))
          .onConflictDoNothing();
      if (record.votes.length)
        await tx
          .insert(votes)
          .values(record.votes.map((v) => ({ ...v, roundId: record.roundId })))
          .onConflictDoNothing();
      await tx
        .update(rounds)
        .set({ winnerPlayerIds: record.winnerPlayerIds, endedAt: new Date() })
        .where(eq(rounds.id, record.roundId));
    });
  },

  async finishGame(record) {
    await db.transaction(async (tx) => {
      for (const p of record.players) {
        await tx
          .update(roomPlayers)
          .set({
            roundWins: p.roundWins,
            votesReceived: p.votesReceived,
            zeroVoteRounds: p.zeroVoteRounds,
            isWinner: p.isWinner,
          })
          .where(eq(roomPlayers.id, p.playerId));
      }
      await tx.update(rooms).set({ status: "finished", finishedAt: new Date() }).where(eq(rooms.id, record.roomId));

      // Only ranked games (enough players) feed the global leaderboard.
      if (!record.ranked) return;
      for (const p of record.players) {
        const points = p.roundWins * SCORING.roundWin + (p.isWinner ? SCORING.gameWin : 0);
        const gameWin = p.isWinner ? 1 : 0;
        await tx
          .insert(playerStats)
          .values({
            userId: p.userId,
            gamesPlayed: 1,
            gamesWon: gameWin,
            roundsWon: p.roundWins,
            votesReceived: p.votesReceived,
            zeroVoteRounds: p.zeroVoteRounds,
            points,
          })
          .onConflictDoUpdate({
            target: playerStats.userId,
            set: {
              gamesPlayed: sql`${playerStats.gamesPlayed} + 1`,
              gamesWon: sql`${playerStats.gamesWon} + ${gameWin}`,
              roundsWon: sql`${playerStats.roundsWon} + ${p.roundWins}`,
              votesReceived: sql`${playerStats.votesReceived} + ${p.votesReceived}`,
              zeroVoteRounds: sql`${playerStats.zeroVoteRounds} + ${p.zeroVoteRounds}`,
              points: sql`${playerStats.points} + ${points}`,
            },
          });
      }
    });
  },

  async saveChat(roomId, message) {
    await db.insert(chatMessages).values({
      id: message.id,
      roomId,
      userId: message.userId,
      displayName: message.displayName,
      kind: message.kind,
      text: message.text,
      createdAt: new Date(message.createdAt),
    });
  },
};
