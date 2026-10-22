import { useAuth } from "@clerk/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mun/shared";
import { API_URL } from "./config";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: GameSocket | null;
  connected: boolean;
  error: string | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false, error: null });

/** One authenticated Socket.IO connection per signed-in session. */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<SocketContextValue>({ socket: null, connected: false, error: null });

  useEffect(() => {
    if (!isSignedIn) {
      setState({ socket: null, connected: false, error: null });
      return;
    }
    const socket: GameSocket = io(API_URL || undefined, {
      // Called on every (re)connect, so an expired token is replaced transparently.
      auth: (cb) => {
        getToken()
          .then((token) => cb({ token }))
          .catch(() => cb({}));
      },
      transports: ["websocket", "polling"],
    });
    const update = (patch: Partial<SocketContextValue>) => setState((s) => ({ ...s, ...patch, socket }));
    socket.on("connect", () => update({ connected: true, error: null }));
    socket.on("disconnect", () => update({ connected: false }));
    socket.on("connect_error", (err) =>
      update({ connected: false, error: err.message === "unauthorized" ? "Session expired - please sign in again." : "Connecting to the server..." }),
    );
    setState({ socket, connected: socket.connected, error: null });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isSignedIn, getToken]);

  return <SocketContext.Provider value={state}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
