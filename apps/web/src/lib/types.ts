export interface MeResponse {
  user: { id: string; email: string | null; displayName: string; imageUrl: string | null; isAdmin: boolean };
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    roundsWon: number;
    votesReceived: number;
    zeroVoteRounds: number;
    points: number;
  } | null;
  rank: number | null;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  imageUrl: string | null;
  points: number;
  gamesPlayed: number;
  gamesWon: number;
  roundsWon: number;
  votesReceived: number;
  zeroVoteRounds: number;
}

export interface Overview {
  players: number;
  gamesPlayed: number;
  resolutions: number;
  liveRooms: number;
  playersOnline: number;
}
