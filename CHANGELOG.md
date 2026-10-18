# Changelog

Following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with
[semantic versioning](https://semver.org/).

## [1.0.0] — unreleased

The first public version: a Windows app.

### Added

- Today, tasks, calendar, money, notes and lists — with search and "add in a
  sentence" (`Ctrl+K`), in English and Hebrew.
- English and Hebrew interface: Windows' language on first launch, switchable
  in Settings › Preferences; Hebrew right to left.
- On the tasks screen, drag a task to another day (today, tomorrow, the days
  ahead, no date), or click its handle to pick a date — with undo.
- Desktop app (Tauri): installs for the current user, no administrator rights;
  the installer follows Windows' language.
- Local data in SQLite, with daily backups (last 14), a backup before every
  database upgrade, and an extra backup folder of your choice.
- First launch: language, a name for the greeting, and sample data that's
  removed with one click.
- Google Calendar (read only, up to 9 calendars) and Claude for "add in a
  sentence" — secrets are encrypted.
- Tray, Windows notifications even with the window closed, start with Windows
  (optional), single instance.
- `mymanage-mcp.mjs`, an optional read-only MCP server: Claude can read your
  tasks, calendar, money, notes and lists. It never writes and never sees your
  secrets. Attached to each release.
- Updates from GitHub Releases: checked at launch and once a day, installed only
  when you agree, with a backup first. Settings › About.
