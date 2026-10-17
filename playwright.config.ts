import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
const ICS_PORT = 3101;

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
    // The morning brief and the first-run questions open by themselves on a
    // first visit; tests that aren't about them start with them done.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PORT}`,
          localStorage: [
            {
              name: "lior-device",
              value: JSON.stringify({
                autoBrief: false,
                onboarded: true,
                // The tests read the Hebrew texts; English has its own.
                language: "he",
                fired: {},
              }),
            },
          ],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Stand-ins for two Google calendars (see e2e/ics-server.mjs).
      command: `node e2e/ics-server.mjs`,
      url: `http://localhost:${ICS_PORT}/one.ics`,
      reuseExistingServer: false,
      env: { ICS_PORT: String(ICS_PORT) },
    },
    {
      command: `node e2e/reset-db.mjs && npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}/api/data`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        LIOR_DB_PATH: path.join(process.cwd(), "e2e", ".data", "e2e.db"),
        GOOGLE_CALENDAR_ICS_URL: `http://localhost:${ICS_PORT}/one.ics`,
        GOOGLE_CALENDAR_ICS_URL_2: `http://localhost:${ICS_PORT}/two.ics`,
        GOOGLE_CALENDAR_NAME_2: "עבודה",
        // Never the real Claude API from tests: the local reader answers.
        ANTHROPIC_API_KEY: "",
      },
    },
  ],
});
