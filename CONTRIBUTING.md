# Contributing

Thanks for wanting to help. A few rules, so a change reaches `main` quickly.

## Before you start

- **A bug** — open an issue with the "Bug" template: what you did, what you
  expected, what happened, and the version.
- **An idea** — open an issue with the "Feature request" template before
  writing code, to check it fits the product
  ([docs/DESKTOP.md](docs/DESKTOP.md) section 3: local first, no account, no
  server).
- **Security** — not in an issue. See [SECURITY.md](SECURITY.md).

## Making a change

1. Fork, and branch from `main`.
2. Run it from source — [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
3. Check — this is also what GitHub Actions runs on every PR:
   ```bash
   npm run lint && npx tsc --noEmit && npm test && npm run build
   cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
   ```
   A change you can see on screen — also `npm run test:e2e`. A change to the
   desktop app — also the smoke test (`scripts/desktop-smoke.mjs`).
4. A small PR on one subject, saying what and why.

## Style

- The interface is in English and Hebrew. Every text goes through
  `src/lib/i18n` — in both languages, Hebrew right to left. Use start/end, not
  left/right, in layout.
- Logic and queries are in TypeScript; Rust only for what the page can't do
  (DESKTOP.md section 3).
- **No personal data in the repository**: no names, calendar addresses or keys.
  Secrets come in through the settings, at run time.
- New code comes with a test. A fixed bug comes with a test that failed before
  the fix.

Contributions are published under the [MIT](LICENSE) licence.
