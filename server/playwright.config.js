import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://localhost:5173", channel: "chrome", headless: true },
  webServer: {
    command: "npm.cmd run dev -- --port 5173",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 60000,
    env: { VITE_API_URL: "http://127.0.0.1:5000" },
  },
});
