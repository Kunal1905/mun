import { RedirectToSignIn, Show } from "@clerk/react";
import type { ReactNode } from "react";
import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { MeProvider, useMe } from "./lib/me";
import { SocketProvider } from "./lib/socket";
import { ToastProvider } from "./lib/toast";
import { PageLoader } from "./components/ui";
import Admin from "./pages/Admin";
import { SignInPage, SignUpPage } from "./pages/Auth";
import Daily from "./pages/Daily";
import Landing from "./pages/Landing";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import Play from "./pages/Play";
import Profile from "./pages/Profile";
import Replay from "./pages/Replay";
import Room from "./pages/Room";

function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { me } = useMe();
  if (!me) return <PageLoader />;
  if (!me.user.isAdmin) return <NotFound />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <MeProvider>
        <SocketProvider>
          <Routes>
            <Route path="/room/:code" element={<Protected><Room /></Protected>} />
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/play" element={<Protected><Play /></Protected>} />
              <Route path="/daily" element={<Protected><Daily /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/replay/:roomId" element={<Protected><Replay /></Protected>} />
              <Route path="/admin" element={<Protected><AdminOnly><Admin /></AdminOnly></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SocketProvider>
      </MeProvider>
    </ToastProvider>
  );
}
