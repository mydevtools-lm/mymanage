# mymanage

A Windows desktop app for running your day — tasks, calendar, money, notes and
lists, in one place, in English or Hebrew. Everything stays on your computer:
no account, no server, no tracking.

[עברית](README.he.md)

![Today](docs/screenshots/today.png)

## What's inside

| Screen | What it's for |
|---|---|
| **Today** | The day on a timeline — events and tasks by the hour, what's carried over, the week ahead and the month's balance. A morning brief |
| **Tasks** | By when they're due, subtasks, routines, reminders, an archive; drag a task to another day |
| **Calendar** | Month, week and list. Recurring events, drag and drop, and up to 9 Google calendars (read only) |
| **Money** | Month and year, recurring transactions, budgets, bank statement import, CSV and a printable report |
| **Notes & lists** | Reusable lists, and notes with colours and pins |

Everywhere: `Ctrl+K` searches everything and adds in a sentence — type "meeting
with the accountant tomorrow at 10" and get the event, ready to confirm. `?`
shows the keyboard shortcuts.

| | |
|---|---|
| ![Tasks](docs/screenshots/tasks.png) | ![Calendar](docs/screenshots/calendar.png) |
| ![Money](docs/screenshots/finance.png) | ![Settings](docs/screenshots/settings.png) |

## Install

1. Download the installer (`…_x64-setup.exe`) from the [latest release](../../releases/latest).
2. Run it. It installs for your Windows user only — no administrator rights.
3. On first launch, choose a language (Windows' own is preselected), say what to
   call you, and start empty or with sample data (removed with one click).

**"Windows protected your PC"?** The installer isn't signed with a paid
certificate yet, so SmartScreen doesn't know it. Choose **More info**, then
**Run anyway**. All the code is here, and the installer is built from it by
GitHub Actions.

Requires Windows 10 or 11 (64‑bit). WebView2 ships with Windows; the installer
downloads it if it's missing.

## Your data

| What | Where |
|---|---|
| The database | `%APPDATA%\io.github.mydevtools-lm.management\data.db` |
| Daily backups (last 14) | `backups\` in the same folder, plus a folder of your choice — Settings › Preferences |
| Manual backup | Settings › Backup — a JSON file you can import back |

**Google Calendar addresses and the Claude key** are stored encrypted in that
folder (Windows DPAPI): only your Windows user on this computer can decrypt
them, and the app never shows them again.

**Updates** — when a new version is out, the app asks whether to update now or
when you quit, and backs up first. Settings › About shows the version.

**Uninstall** from Windows Settings › Apps. Your data stays unless you tick
"Delete the application data".

## Connections (optional)

- **Google Calendar** — Settings › Connections. Paste the "Secret address in
  iCal format" from your calendar's settings in Google Calendar. Read only.
- **Claude** — makes "add in a sentence" smarter. Paste an API key from
  console.anthropic.com. Without one, local rules read the sentence (English
  and Hebrew).

The network is used for these two only. No account, no telemetry.

## Let Claude read your data (optional)

`mymanage-mcp.mjs`, attached to each release, is a small
[MCP](https://modelcontextprotocol.io) server. It lets Claude (Claude Code,
Claude Desktop) answer "what's on today?" or "how much did I spend this month?"
from your real data. It **only reads**: the database is opened read-only, there
is no tool that changes anything, and your secrets (calendar addresses, the
Claude key) are never exposed. It needs [Node.js](https://nodejs.org) 22 or later.

1. Download `mymanage-mcp.mjs` from the [latest release](../../releases/latest)
   and keep it somewhere, say `C:Tools`.
2. Add it to Claude Code:
   ```
   claude mcp add mymanage -- node --experimental-sqlite C:Toolsmymanage-mcp.mjs
   ```
   or to Claude Desktop's `claude_desktop_config.json`:
   ```json
   { "mcpServers": { "mymanage": {
       "command": "node",
       "args": ["--experimental-sqlite", "C:\Tools\mymanage-mcp.mjs"]
   } } }
   ```

It reads the installed app's data by default; `--db <path to data.db>` points it
elsewhere. Tools: `today`, `list_tasks`, `list_events`, `list_transactions`,
`finance_summary`, `search`, `list_notes`, `get_note`, `list_checklists`,
`list_categories`. The app can stay open while Claude reads.

## Open source

[MIT](LICENSE). To run it from source or contribute, see
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
Security issues: [SECURITY.md](SECURITY.md). What changed in each version:
[CHANGELOG.md](CHANGELOG.md).
