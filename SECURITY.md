# Security

## Reporting a problem

**Not in a public issue.** Report it privately through GitHub: the
**Security** tab of this repository › **Report a vulnerability**. You'll get an
answer within a week, and an update when there's a fix.

Worth including: what the problem is, how to reproduce it, and the version.

## What matters most here

- **Secrets** — Google Calendar addresses and the Claude key are stored
  encrypted (Windows DPAPI) and never go back to the page. A way to read them
  from the page, or from outside your Windows user, is a problem.
- **The page and the bridge** — the page sends SQL to the Rust bridge, which is
  safe only as long as nothing but the app's own code runs in the page. Getting
  around the CSP, or a way to run outside content in the page, is a problem.
- **What leaves the app** — links open in the browser only if they are `http` or
  `https`. Opening a file or another protocol is a problem.

- **The MCP server** — `mymanage-mcp.mjs` must only read. A tool that writes
  to the database, or that returns the Google Calendar addresses or the Claude
  key, is a problem.

## Supported versions

Only the latest version gets security fixes.
