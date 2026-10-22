import { Show, UserButton } from "@clerk/react";
import { CalendarDays, Gavel, Shield, Trophy, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { useMe } from "../lib/me";
import { cn } from "../lib/cn";
import { Button, Logo } from "./ui";

const NAV = [
  { to: "/play", label: "Play", icon: Gavel },
  { to: "/daily", label: "Daily", icon: CalendarDays },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function Layout() {
  const { me } = useMe();
  const nav = me?.user.isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: Shield }] : NAV;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-700/10 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="MUN Crisis home">
            <Logo />
          </Link>
          <Show when="signed-in">
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive ? "bg-ink-700 text-paper" : "text-ink-500 hover:bg-ink-700/5 hover:text-ink-700",
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </Show>
          <div className="ml-auto flex items-center gap-3">
            <Show when="signed-in">
              {me?.stats && (
                <span className="hidden items-center gap-1.5 rounded-full bg-brass-100 px-3 py-1 text-xs font-semibold text-brass-700 sm:flex">
                  <Trophy className="size-3.5" />
                  {me.stats.points} pts
                </span>
              )}
              <UserButton />
            </Show>
            <Show when="signed-out">
              <Link to="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/sign-up">
                <Button size="sm">Join the floor</Button>
              </Link>
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      <footer className="hidden border-t border-ink-700/10 py-6 text-center text-xs text-ink-400 md:block">
        MUN Crisis - debate practice for delegates. The table decides; the AI only coaches.
      </footer>

      {/* Mobile tab bar */}
      <Show when="signed-in">
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-700/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", isActive ? "text-ink-800" : "text-ink-400")
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </Show>
    </div>
  );
}
