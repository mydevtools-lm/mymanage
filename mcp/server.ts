import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isLocale, setLocale } from "../src/lib/i18n";
import { openReadOnly, resolveDbPath } from "./readonly-db";
import { createServer } from "./tools";
import { openWritable } from "./writable-db";

/**
 * mymanage's MCP server: lets a chat read the app's data — tasks, calendar,
 * money, notes, lists (ד9) — and, only with --write, change it (ד11). The chat
 * app starts it itself; it talks over stdin/stdout, so everything meant for a
 * person goes to stderr.
 *
 *   node --experimental-sqlite mymanage-mcp.mjs [--write] [--db <data.db>] [--lang en|he]
 */

const HELP = `mymanage-mcp — mymanage's data for a chat. Reads only, unless --write is given.

  node --experimental-sqlite mymanage-mcp.mjs [--write] [--db <path to data.db>] [--lang en|he]

  --write Also let the chat add, change and delete. Also on when MYMANAGE_WRITE=1.
  --db    The database. Default: the installed app's (%APPDATA%\\io.github.mydevtools-lm.management\\data.db).
          Also read from the MYMANAGE_DB environment variable.
  --lang  The language of category names in search results (en or he; default en).
          Also read from MYMANAGE_LANG.

Add it to Claude Code:
  claude mcp add mymanage -- node --experimental-sqlite <path>/mymanage-mcp.mjs --write
`;

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const at = args.indexOf(`--${name}`);
  if (at >= 0) return args[at + 1];
  const joined = args.find((a) => a.startsWith(`--${name}=`));
  return joined?.slice(name.length + 3);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stderr.write(HELP);
    return;
  }
  const lang = flag("lang") ?? process.env.MYMANAGE_LANG;
  if (lang) {
    if (!isLocale(lang))
      throw new Error(`--lang must be en or he, not ${lang}.`);
    setLocale(lang);
  }
  const file = resolveDbPath(flag("db"));
  const write =
    process.argv.includes("--write") || process.env.MYMANAGE_WRITE === "1";
  const database = write ? await openWritable(file) : await openReadOnly(file);
  const server = createServer(database, { write });
  await server.connect(new StdioServerTransport());
  process.stderr.write(
    `mymanage-mcp: ${write ? "reading and writing" : "reading (read-only)"} ${file}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `mymanage-mcp: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(1);
});
