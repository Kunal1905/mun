import { SignIn, SignUp } from "@clerk/react";
import { Eyebrow } from "../components/ui";

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper-grain flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-4xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-sm text-center md:text-left">
          <Eyebrow>The floor is yours</Eyebrow>
          <h1 className="mt-3 text-4xl font-semibold text-balance">{title}</h1>
          <p className="mt-3 text-ink-500">
            Your delegate profile keeps your round wins, votes and coaching cards across every room you play.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthShell title="Welcome back, delegate.">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthShell>
  );
}

export function SignUpPage() {
  return (
    <AuthShell title="Take your seat at the table.">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}
