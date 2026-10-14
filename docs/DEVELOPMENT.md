# פיתוח

איך מריצים מהקוד, בודקים ובונים. האפיון של המוצר ב‑[SPEC.md](SPEC.md), ושל
אפליקציית הדסקטופ ב‑[DESKTOP.md](DESKTOP.md).

## דרישות

- Node 22 ומעלה
- Rust (stable, 1.90 ומעלה) — רק לאפליקציית הדסקטופ
- Windows 10/11 לבנייה של המתקין

## שתי דרכים להריץ

אותם מסכים ואותה שכבת נתונים, בשתי הובלות (DESKTOP.md סעיף 5.3):

| | דפדפן | דסקטופ (Tauri) |
|---|---|---|
| הרצה | `npm run dev` → `http://localhost:3000` | `npm run tauri dev` |
| נתונים | `data/lior.db` דרך `node:sqlite` ונתיבי `/api` | `%APPDATA%\<מזהה>\data.db` דרך הגשר ב‑`src-tauri/src/db.rs` |
| סודות | `.env.local` (ראה `.env.example`) | הגדרות › חיבורים, מוצפנים ב‑DPAPI |

`node:sqlite` עדיין מאחורי דגל, ולכן הסקריפטים מריצים את Next עם
`--experimental-sqlite`.

## בדיקות

```bash
npm run lint        # ESLint
npx tsc --noEmit    # טיפוסים
npm test            # Vitest — לוגיקה, repo.ts מול שני המתאמים, נתיבים
npm run test:e2e    # Playwright — זרימות, נגישות (axe) וצילומי מסך, על בנייה ומסד נפרדים
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

**בדיקת העשן של הדסקטופ** רצה על בניית בדיקה עם מזהה משלה
(`src-tauri/tauri.test.conf.json`), כך שהיא לא נוגעת בנתונים של אפליקציה מותקנת:

```bash
npm run build:desktop-test
node scripts/desktop-smoke.mjs first-run   # צריך תיקיית נתונים ריקה
node scripts/desktop-smoke.mjs write
node scripts/desktop-smoke.mjs read
node scripts/desktop-smoke.mjs services    # יומן ציבורי ומפתח Claude מזויף, ומנקה אחרי עצמו
node scripts/desktop-smoke.mjs shell       # מגש, תזכורת במגש, מופע יחיד
```

היא מתחברת ל‑WebView2 דרך פורט הדיבאג, ומריצה את האפליקציה במצב שקט
(`MANAGEMENT_SMOKE_QUIET`): התראות וקישורים נרשמים ולא מוצגים.

## בנייה

```bash
npm run build          # מצב דפדפן (שרת Next)
npm run tauri build    # מתקין NSIS ב‑src-tauri/target/release/bundle/nsis/
```

הבנייה של הדסקטופ מייצאת את המסכים לקבצים סטטיים (`NEXT_TARGET=desktop`,
`output: "export"`) — בלי נתיבי `/api` ובלי שרת.

## מבנה

| תיקייה | מה יש בה |
|---|---|
| `src/app` | המסכים (App Router) ונתיבי `/api` של מצב הדפדפן |
| `src/components` | רכיבי המסכים; `ui/` — shadcn |
| `src/lib/repo.ts` | כל השאילתות, מאחורי `db-adapter.ts` |
| `src/lib/api-routes.ts` | הנתב המשותף — משרת את Next ואת הדסקטופ |
| `src/lib/store.ts` | מצב המסכים (Zustand) |
| `src-tauri/src` | Rust: הגשר ל‑SQLite, גיבוי, סודות, רשת, מגש והתראות |
| `e2e`, `test` | Playwright ועזרי Vitest |
| `scripts` | בדיקת העשן של הדסקטופ, ציור אייקונים |

## גרסה חדשה

1. מעדכנים את הגרסה ב‑`package.json`, `src-tauri/tauri.conf.json`
   ו‑`src-tauri/Cargo.toml`, ומוסיפים אותה ל‑[CHANGELOG.md](../CHANGELOG.md).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `.github/workflows/release.yml` בונה את המתקין ופותח טיוטת Release. בודקים
   ומפרסמים ידנית.
