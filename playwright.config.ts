import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3100;

/**
 * End-to-end checks against a production build, on its own port and its own
 * database file — never data/lior.db. One worker: a single browser at a time.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node e2e/reset-db.mjs && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/data`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      LIOR_DB_PATH: path.join(process.cwd(), "e2e", ".data", "e2e.db"),
    },
  },
});
