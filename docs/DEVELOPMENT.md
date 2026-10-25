# Development

How to run it from source, test it and build it. The product spec is in
[SPEC.md](SPEC.md) and the desktop app's in [DESKTOP.md](DESKTOP.md) (both in
Hebrew).

## Requirements

- Node 22 or later
- Rust (stable, 1.90 or later) — for the desktop app only
- Windows 10/11 to build the installer

## Two ways to run it

The same screens and the same data layer, carried two ways (DESKTOP.md 5.3):

|         | Browser                                                    | Desktop (Tauri)                                                              |
| ------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Run     | `npm run dev` → `http://localhost:3000`                    | `npm run tauri dev`                                                          |
| Data    | `data/lior.db` through `node:sqlite` and the `/api` routes | `%APPDATA%\<identifier>\data.db` through the bridge in `src-tauri/src/db.rs` |
| Secrets | `.env.local` (see `.env.example`)                          | Settings › Connections, encrypted with DPAPI                                 |

`node:sqlite` is still behind a flag, so the scripts run Next with
`--experimental-sqlite`.

## Languages

The interface is in English and Hebrew (`src/lib/i18n`). `t()` returns the
messages of the current language; each area of the app has a messages file
under `src/lib/i18n/messages/` with an `en` object and a `he` object of exactly
the same shape — a key missing in one language fails the type check. Never call
`t()` at module level. Dates use `dateLocale()`, numbers and currency
`intlLocale()` (through `formatDate` / `formatCurrency` in `src/lib/format.ts`).

"Add in a sentence" reads Hebrew (`src/lib/nl-parse.ts`) and English
(`src/lib/nl-parse-en.ts`) locally, chosen by the sentence itself.

## Tests

```bash
npm run lint        # ESLint
npx tsc --noEmit    # types
npm test            # Vitest — logic, repo.ts against both adapters, routes
npm run test:e2e    # Playwright — flows, accessibility (axe) and screenshots, on their own build and database
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

`npm test` also runs `mcp/server.test.ts`: the MCP server's tools against a temporary database, and the bundled server over stdio.

Vitest and the existing Playwright tests run in Hebrew (`test/setup-db.ts`,
`playwright.config.ts`); English has its own tests.

**The desktop smoke test** runs on a test build with its own identifier
(`src-tauri/tauri.test.conf.json`), so it never touches an installed app's data:

```bash
npm run build:desktop-test
node scripts/desktop-smoke.mjs first-run   # needs an empty data folder
node scripts/desktop-smoke.mjs write
node scripts/desktop-smoke.mjs read
node scripts/desktop-smoke.mjs services    # a public calendar and a fake Claude key; cleans up after itself
node scripts/desktop-smoke.mjs shell       # tray, a reminder from the tray, single instance
node scripts/desktop-smoke.mjs screenshots # the README's pictures in English; add "he" for Hebrew
```

It drives WebView2 through its debug port and runs the app in quiet mode
(`MANAGEMENT_SMOKE_QUIET`): notifications and links are recorded, not shown.

## Build

```bash
npm run build          # browser mode (a Next server)
npm run tauri build    # NSIS installer in src-tauri/target/release/bundle/nsis/
```

The desktop build exports the screens as static files (`NEXT_TARGET=desktop`,
`output: "export"`) — no `/api` routes and no server.

## Holidays

`src/lib/holidays-data.ts` is generated: Israel's holidays and memorial and
national days, by `@hebcal/core`, so the app needs no calendar library at run
time. To cover other years:

```bash
node scripts/gen-holidays.mjs 2026 2032   # then commit the result
```

The two groups behave like read-only calendars of their own (`use-holidays.ts`):
their colour and visibility are kept with the Google calendars' preferences.
The lists of included names are at the top of the script.

## Sync between computers

How it works is in DESKTOP.md (ד8). In short: SQLite triggers (migration v8) record
every write to the synchronised tables into `_sync_out` and stamp each field in
`_sync_field`; `src/lib/sync/engine.ts` writes the outbox as files in the shared
folder and merges other computers' files, the later stamp winning field by field.
`src-tauri/src/sync.rs` is the only way the page reaches the folder, and only inside
it. Sync is off until a folder is chosen, and then nothing else in the app changes: the
triggers see every write, whoever makes it.

**When you change a table** that is synchronised (`SYNC_TABLES` in
`src/lib/sync/tables.ts`): add the column to its list, and add a migration that calls
`syncTriggersSql()` again, so the triggers know the new column. A test fails until you do.

```bash
npx vitest run src/lib/sync        # the engine: several computers, one folder
node scripts/desktop-smoke.mjs sync   # the real app and a second computer (a Node peer)
```

## The MCP server

`mcp/` is a small read-only [MCP](https://modelcontextprotocol.io) server over
the app's database (DESKTOP.md ד9): `server.ts` starts it over stdio,
`tools.ts` has the tools, `readonly-db.ts` opens the file with SQLite's own
read-only mode. Tools reuse `repo.ts` and the pure helpers (`finance.ts`,
`event-series.ts`, `search.ts`), so they count a month the way the screens do.
Nothing in it writes, and nothing reads the secrets (they're in an encrypted file
outside the database). A new tool must stay that way.

```bash
npm run build:mcp                      # mcp/dist/mymanage-mcp.mjs, one file (esbuild)
node --experimental-sqlite mcp/dist/mymanage-mcp.mjs --db path/to/data.db
```

`release.yml` attaches that file to every release. How people connect it to
Claude is in the [README](../README.md#let-claude-read-your-data-optional).

## Layout

| Folder                  | What's in it                                                                     |
| ----------------------- | -------------------------------------------------------------------------------- |
| `src/app`               | The screens (App Router) and the browser mode's `/api` routes                    |
| `src/components`        | The screens' components; `ui/` — shadcn                                          |
| `src/lib/repo.ts`       | Every query, behind `db-adapter.ts`                                              |
| `src/lib/api-routes.ts` | The shared router — serves Next and the desktop app                              |
| `src/lib/store.ts`      | Screen state (Zustand)                                                           |
| `src/lib/i18n`          | Languages: `t()`, and a messages file per area                                   |
| `src-tauri/src`         | Rust: the SQLite bridge, backups, secrets, network, tray, notifications, updates |
| `mcp`                   | The read-only MCP server for Claude                                              |
| `e2e`, `test`           | Playwright, and Vitest helpers                                                   |
| `scripts`               | The desktop smoke test, icon drawing, the update key setup                       |

## The update key (once)

Automatic updates are signed with the project's key. Without it a release ships
without updating itself. The private key stays with you and in GitHub's
secrets — never in the repository.

The simplest way — a script that does it all (creates or finds the key, checks
its password, saves it to GitHub):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-updater-key.ps1
```

Or by hand, in PowerShell (`~` isn't expanded in an argument to `npx`, which
would create the key inside the project — hence `$HOME`):

```powershell
npx tauri signer generate -w "$HOME\.tauri\management.key"
Get-Content "$HOME\.tauri\management.key" -Raw | gh secret set TAURI_SIGNING_PRIVATE_KEY
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
Get-Content "$HOME\.tauri\management.key.pub" -Raw | gh variable set UPDATER_PUBKEY
```

The password isn't shown as you type it. The repository ignores `*.key`.

Keep the password and `management.key` somewhere safe off the computer too —
without them no update can be signed, and installed copies get no more updates.

## A new version

1. Set the version in `package.json`, `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml`, and add it to [CHANGELOG.md](../CHANGELOG.md).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `.github/workflows/release.yml` builds the installer and opens a draft
   release. Check it and publish it by hand. With the update key it also
   attaches `latest.json`, and installed copies offer the update once it's
   published.
