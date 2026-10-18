// Bundles the MCP server (mcp/server.ts) and everything it imports into one
// file, so it can be handed out and run with nothing but Node:
//   npm run build:mcp   →   mcp/dist/mymanage-mcp.mjs
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function buildMcp(outfile = `${root}mcp/dist/mymanage-mcp.mjs`) {
  await build({
    absWorkingDir: root,
    entryPoints: ["mcp/server.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    legalComments: "none",
    // A few of the bundled packages are CommonJS and call require().
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    logLevel: "warning",
  });
  return outfile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = await buildMcp();
  console.log(`built ${file}`);
}
