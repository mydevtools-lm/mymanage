// Runs as part of the e2e server's start command, before the database is
// opened, so every run starts from an empty database. (A Playwright
// globalSetup could run after the server already holds the file open.)
import { rmSync } from "node:fs";
import path from "node:path";

rmSync(path.join(process.cwd(), "e2e", ".data"), {
  recursive: true,
  force: true,
});
