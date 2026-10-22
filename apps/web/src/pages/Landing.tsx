import { Show } from "@clerk/react";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, Crown, Gavel, MessagesSquare, PenLine, Radio, Sparkles, Timer, Trophy, Users, Vote } from "lucide-react";
import { Link } from "react-router";
import { Avatar, Badge, Button, Card, Eyebrow } from "../components/ui";
import { useFetch } from "../lib/api";
import type { LeaderboardRow, Overview } from "../lib/types";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const STEPS = [
  {
    icon: Gavel,
    title: "Take the crisis",
    body: "A live agenda and a delegation with a stake in the outcome - from the Strait of Hormuz to a failing glacier dam.",
  },
  {
    icon: MessagesSquare,
    title: "Argue, then draft",
    body: "Sixty seconds on the floor while the table reacts and raises points of information. Then one line to fix it.",
  },
  {
    icon: Vote,
    title: "Vote and get coached",
    body: "Anonymous voting, a staged reveal, and a coaching card on clarity, relevance, persuasion and concision.",
  },
];

export default function Landing() {
  const overview = useFetch<Overview>("/stats/overview");
  const top = useFetch<{ rows: LeaderboardRow[] }>("/leaderboard?limit=5");
  const o = overview.data;

  return (
    <div>
      {/* Hero */}
      <section className="bg-chamber relative overflow-hidden text-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <motion.div {...fade()}>
              <Badge tone="dark" className="gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                {o ? `${o.playersOnline} delegates online · ${o.liveRooms} live rooms` : "Live multiplayer debate"}
              </Badge>
            </motion.div>
            <motion.h1 {...fade(0.05)} className="mt-6 text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
              Debate. Draft.
              <br />
              <span className="text-brass-400">Decide.</span>
            </motion.h1>
            <motion.p {...fade(0.1)} className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75">
              Model UN practice in fast ten-minute rounds. Argue a crisis agenda with real delegates, write a one-line resolution,
              and let the table vote on the best one.
            </motion.p>
            <motion.div {...fade(0.15)} className="mt-8 flex flex-wrap gap-3">
              <Show when="signed-in">
                <Link to="/play">
                  <Button variant="brass" size="lg" icon={<Gavel className="size-4" />}>
                    Play now
                  </Button>
                </Link>
                <Link to="/daily">
                  <Button variant="light" size="lg" icon={<CalendarDays className="size-4" />}>
                    Today's Daily Crisis
                  </Button>
                </Link>
              </Show>
              <Show when="signed-out">
                <Link to="/sign-up">
                  <Button variant="brass" size="lg">
                    Take your seat <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link to="/leaderboard">
                  <Button variant="light" size="lg" icon={<Trophy className="size-4" />}>
                    See the leaderboard
                  </Button>
                </Link>
              </Show>
            </motion.div>

            <motion.dl {...fade(0.2)} className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {[
                { label: "Delegates", value: o?.players },
                { label: "Games played", value: o?.gamesPlayed },
                { label: "Resolutions", value: o?.resolutions },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs uppercase tracking-wider text-paper/50">{s.label}</dt>
                  <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{s.value ?? "-"}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Product preview */}
          <motion.div {...fade(0.15)} className="relative hidden lg:block">
            <div className="absolute -inset-8 rounded-[2.5rem] bg-brass/10 blur-3xl" />
            <div className="relative space-y-4">
              <div className="animate-float rounded-2xl bg-paper p-5 text-ink-700 shadow-lift">
                <div className="flex items-center justify-between">
                  <Badge tone="brass">Round 2 · Debate</Badge>
                  <span className="flex items-center gap-1 font-mono text-sm font-semibold text-crimson">
                    <Timer className="size-4" /> 0:42
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold">Undersea Cable Sabotage</h3>
                <p className="mt-1 text-sm text-ink-500">Three internet cables cut in one night. Banks across East Africa are offline.</p>
                <div className="mt-4 rounded-xl bg-paper-100 p-3 text-sm leading-relaxed">
                  <span className="font-semibold text-brass-700">Kenya · </span>
                  "Our delegation will not accept a fund that pays for repairs but never asks who dragged the anchor..."
                  <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-ink-700" />
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <span className="rounded-full bg-sage-100 px-2.5 py-1 font-semibold text-sage">Agree 4</span>
                  <span className="rounded-full bg-brass-100 px-2.5 py-1 font-semibold text-brass-700">Applause 2</span>
                  <span className="rounded-full bg-crimson-100 px-2.5 py-1 font-semibold text-crimson">POI raised</span>
                </div>
              </div>
              <div className="ml-12 rounded-2xl bg-ink-700 p-5 shadow-lift ring-1 ring-white/10">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brass-400">
                  <Sparkles className="size-4" /> Coaching card
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Clarity", 8],
                    ["Relevance", 9],
                    ["Persuasion", 7],
                    ["Concise", 8],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/5 py-2">
                      <div className="font-display text-2xl font-semibold">{v}</div>
                      <div className="text-[10px] uppercase tracking-wider text-paper/50">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-paper-grain">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <motion.div {...fade()} className="max-w-2xl">
            <Eyebrow>Ten minutes, one table</Eyebrow>
            <h2 className="mt-3 text-4xl font-semibold text-balance">A full committee session, compressed into a round.</h2>
          </motion.div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div key={step.title} {...fade(i * 0.08)}>
                <Card className="h-full p-6 transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-ink-700 text-brass-400">
                      <step.icon className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-500">{step.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <motion.div {...fade()}>
              <Card className="h-full p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-2xl font-semibold">
                    <Crown className="size-5 text-brass" /> Top delegates
                  </h3>
                  <Link to="/leaderboard" className="text-sm font-medium text-brass-700 hover:underline">
                    Full rankings
                  </Link>
                </div>
                <ol className="mt-5 space-y-2">
                  {top.data?.rows.length ? (
                    top.data.rows.map((r) => (
                      <li key={r.userId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 odd:bg-paper">
                        <span className="w-6 text-center font-display text-lg font-semibold text-ink-400">{r.rank}</span>
                        <Avatar name={r.displayName} src={r.imageUrl} size={32} />
                        <span className="flex-1 truncate font-medium">{r.displayName}</span>
                        <span className="text-sm tabular-nums text-ink-400">{r.gamesWon} wins</span>
                        <span className="w-16 text-right font-semibold tabular-nums">{r.points} pts</span>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-xl bg-paper px-4 py-8 text-center text-sm text-ink-400">
                      {top.loading ? "Loading rankings..." : "No ranked games yet - the first seat at the top is open."}
                    </li>
                  )}
                </ol>
              </Card>
            </motion.div>
            <motion.div {...fade(0.08)}>
              <div className="bg-chamber flex h-full flex-col justify-between rounded-2xl p-8 text-paper shadow-lift">
                <div>
                  <Badge tone="dark">
                    <Radio className="size-3" /> Real-time
                  </Badge>
                  <h3 className="mt-4 text-3xl font-semibold text-balance">Invite your committee with a six-letter code.</h3>
                  <p className="mt-3 leading-relaxed text-paper/70">
                    Open a public room anyone can join, or a private one for your club. The chair keeps time, enforces the rules and
                    tallies the votes - no one has to moderate.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link to="/play">
                    <Button variant="brass" size="lg" icon={<Users className="size-4" />}>
                      Open a room
                    </Button>
                  </Link>
                  <span className="flex items-center gap-1.5 text-sm text-paper/60">
                    <PenLine className="size-4" /> One-line resolutions, 160 characters
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
