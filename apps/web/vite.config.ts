import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// One .env at the monorepo root; only VITE_* variables reach the browser.
const envDir = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const api = `http://localhost:${env.SERVER_PORT || "4000"}`;
  return {
    plugins: [react(), tailwindcss()],
    envDir,
    server: {
      port: 5173,
      proxy: {
        "/api": api,
        "/socket.io": { target: api, ws: true },
      },
    },
  };
});
