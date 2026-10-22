# MUN Crisis

Real-time multiplayer Model UN debate game. Delegates join a room by code, argue a crisis agenda
for 60 seconds each while the table reacts and raises points of information, draft a one-line
resolution, vote anonymously, and get a personal coaching card at the end. Round wins decide the
room; ranked rooms feed a global leaderboard.

## Stack (single monorepo)

```
apps/web        React 19 + Vite + Tailwind v4 + Clerk + Socket.IO client
apps/server     Node + Express 5 + Socket.IO + Drizzle ORM (Neon Postgres) + Clerk
packages/shared Types, limits and socket event contracts used by both sides
```

- **Auth:** Clerk (sign-in UI, session tokens verified on every API call and socket connection).
- **Database:** Neon Postgres via Drizzle ORM. Schema: `apps/server/src/db/schema.ts`.
- **Real-time:** the server is authoritative. It owns the timers and phases, so every player
  sees the same clock and nobody can skip a phase from their browser.
- **AI coaching (optional):** Claude via the Anthropic API. Without a key, a rule-based coach is used.

## Getting started

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run setup               # creates tables in Neon and seeds 28 crisis agendas
npm run dev                 # web on http://localhost:5173, API/sockets on :4000
```

### Environment variables (`.env` at the repo root)

| Variable | Required | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Console → project → **Connect** → connection string (keep `?sslmode=require`) |
| `CLERK_PUBLISHABLE_KEY` | yes | Clerk Dashboard → **API keys** (`pk_test_...`) |
| `CLERK_SECRET_KEY` | yes | Clerk Dashboard → **API keys** (`sk_test_...`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Same value as `CLERK_PUBLISHABLE_KEY` |
| `CLIENT_ORIGIN` | yes | Where the web app runs. `http://localhost:5173` in dev; your domain in production |
| `ADMIN_EMAILS` | no | Comma-separated emails that can open `/admin` |
| `MIN_PLAYERS_FOR_RANKED` | no | Players needed for a game to count on the leaderboard (default 3) |
| `ANTHROPIC_API_KEY` | no | console.anthropic.com. Enables AI coaching cards |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5` |
| `SERVER_PORT` | no | API port (default 4000). Hosts that inject `PORT` also work |
| `VITE_API_URL` | no | Only if the web app is hosted on a different domain than the API |

In the Clerk dashboard, enable the sign-in methods you want (Email, Google, ...). No other Clerk
configuration is needed.

No Neon yet? `npm run db:up` starts a local Postgres in Docker. Then set
`DATABASE_URL=postgresql://mun:mun@localhost:5433/mun_crisis`.

## Testing a multiplayer game locally

Open http://localhost:5173 in two or three different browsers (or one normal window plus private
windows) and sign in with different accounts. One player opens a room and shares the code; the
others join, press **I'm ready**, and the host opens the session.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server + web with hot reload |
| `npm run setup` | `db:push` + `db:seed` |
| `npm run db:push` | Sync the Drizzle schema to the database |
| `npm run db:seed` | Load or refresh the curated agenda pool |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm test` | Game engine unit tests |
| `npm run test:integration -w @mun/server` | Full-stack test (real DB + sockets; Clerk stubbed) |
| `npm run build && npm start` | Production: the server also serves the built web app |

## Deploying

The server serves the built web app, so a single service is enough (Render, Railway, Fly, a VM):

1. Build command: `npm install && npm run build`. Start command: `npm start`.
2. Set the env vars above. Set `CLIENT_ORIGIN` to your public URL (e.g. `https://mun.example.com`).
3. Run `npm run setup` once against the production database.

WebSockets need a host that keeps long-lived connections (not serverless functions).

## How a game works

1. **Lobby:** the host opens a public or private room (random crisis pool or custom agendas,
   1-5 rounds, 2-10 seats). Players join by code or invite link and ready up.
2. **Agenda (12s):** each player is assigned a delegation from the agenda's stakeholders.
3. **Debate (60s per speaker):** the speaker types live and everyone watches. Others react
   (agree, disagree, applause) and may raise one point of information per round. Speakers can
   yield early; disconnected speakers are skipped.
4. **Drafting (90s):** a crisis twist drops, and everyone writes a one-line resolution
   (160 characters). The phase ends early once all drafts are in.
5. **Voting (45s):** resolutions are shown anonymously in a per-player shuffled order. You cannot
   vote for your own.
6. **Reveal (15s):** authors are unmasked and the most-voted resolution wins the round (ties share it).
7. **Results:** the room winner has the most round wins (tie-breaks: total votes, then fewest
   zero-vote rounds). Each player gets a coaching card; the host can call a rematch.

Also included: a **Daily Crisis** (one blind-voted resolution per player per day), a **global
leaderboard**, **profiles** with history and coaching trends, **replays** of finished sessions,
**content reports**, and an **admin console** for the agenda pool and reports.
