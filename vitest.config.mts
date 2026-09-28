import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // node:sqlite is still behind a flag in Node 22.
    pool: "forks",
    execArgv: ["--experimental-sqlite", "--no-warnings"],
    // Every test file gets its own in-memory database unless it says otherwise.
    env: { LIOR_DB_PATH: ":memory:" },
  },
});
