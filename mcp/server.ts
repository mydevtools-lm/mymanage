import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isLocale, setLocale } from "../src/lib/i18n";
import { openReadOnly, resolveDbPath } from "./readonly-db";
import { createServer } from "./tools";

/**
 * mymanage's MCP server (ד9): lets Claude read the app's data — tasks,
 * calendar, money, notes, lists — and never change it. Claude starts it
 * itself; it talks over stdin/stdout, so everything meant for a person goes
 * to stderr.
 *
 *   node --experimental-sqlite mymanage-mcp.mjs [--db <data.db>] [--lang en|he]
 */

const HELP = `mymanage-mcp — read-only access to mymanage's data for Claude

  node --experimental-sqlite mymanage-mcp.mjs [--db <path to data.db>] [--lang en|he]

  --db    The database. Default: the installed app's (%APPDATA%\\io.github.mydevtools-lm.management\\data.db).
          Also read from the MYMANAGE_DB environment variable.
  --lang  The language of category names in search results (en or he; default en).
          Also read from MYMANAGE_LANG.

Add it to Claude Code:
  claude mcp add mymanage -- node --experimental-sqlite <path>/mymanage-mcp.mjs
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
  const server = createServer(await openReadOnly(file));
  await server.connect(new StdioServerTransport());
  process.stderr.write(`mymanage-mcp: reading ${file} (read-only)\n`);
}

main().catch((error) => {
  process.stderr.write(
    `mymanage-mcp: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(1);
});
