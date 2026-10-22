import { KeyRound } from "lucide-react";
import { Logo } from "../components/ui";

/** Shown when the web app is started without a Clerk publishable key. */
export function SetupRequired() {
  return (
    <div className="bg-chamber flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl bg-paper p-8 shadow-lift">
        <Logo />
        <div className="mt-6 flex items-center gap-2 text-crimson">
          <KeyRound className="size-5" />
          <h1 className="text-2xl font-semibold text-ink-700">One step left: add your keys</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          The web app needs a Clerk publishable key. Copy <code className="rounded bg-ink-700/5 px-1">.env.example</code> to{" "}
          <code className="rounded bg-ink-700/5 px-1">.env</code> at the repository root and fill in:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-800 p-4 text-xs leading-relaxed text-paper">
{`VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require`}
        </pre>
        <p className="mt-4 text-sm text-ink-500">Then restart <code className="rounded bg-ink-700/5 px-1">npm run dev</code>.</p>
      </div>
    </div>
  );
}
