import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetcher = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/** Authenticated JSON fetch against the game server. */
export function useApi(): Fetcher {
  const { getToken, isSignedIn } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }) => {
      // Signed-out visitors can still read public endpoints (stats, leaderboard).
      const token = isSignedIn ? await getToken().catch(() => null) : null;
      const res = await fetch(`${API_URL}/api${path}`, {
        method: init?.method ?? (init?.body ? "POST" : "GET"),
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
      return data as T;
    },
    [getToken, isSignedIn],
  ) as Fetcher;
}

/** Minimal data-loading hook: `{ data, error, loading, reload }`. */
export function useFetch<T>(path: string | null) {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
