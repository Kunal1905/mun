import { useAuth } from "@clerk/react";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useFetch } from "./api";
import type { MeResponse } from "./types";

interface MeContextValue {
  me: MeResponse | null;
  reload: () => Promise<void>;
}

const MeContext = createContext<MeContextValue>({ me: null, reload: async () => {} });

/** The signed-in player's profile and stats, as the game server sees them. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const { data, reload, setData } = useFetch<MeResponse>(isSignedIn ? "/me" : null);
  useEffect(() => {
    if (!isSignedIn) setData(null);
  }, [isSignedIn, setData]);
  return <MeContext.Provider value={{ me: data, reload }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
