# Lior Management

מערכת ניהול אישית מקומית: היום, משימות, יומן, כספים, הערות ורשימות.
האפיון המלא נמצא ב־[docs/SPEC.md](docs/SPEC.md). תוכנית ההמשך: מסכים ב־[docs/SCREENS.md](docs/SCREENS.md) (רץ ראשון), והתוכנית הכללית ב־[docs/SPRINTS.md](docs/SPRINTS.md).

## הרצה

```bash
npm install
npm run dev
```

הדפדפן: `http://localhost:3000`.

הנתונים נשמרים במסד SQLite מקומי בקובץ `data/lior.db`, שנוצר אוטומטית בהרצה
הראשונה. הקובץ לא נכנס ל‑git. אם היו נתונים מגרסה קודמת ב‑localStorage, הם
מועברים למסד פעם אחת אוטומטית.

> דורש Node 22+. הסקריפטים מריצים את Next עם `--experimental-sqlite`, כי
> המודול `node:sqlite` עדיין מאחורי דגל.

## חיבור גוגל יומן (רשות)

קריאה בלבד — האירועים מגוגל מוצגים ביומן ובלוח הבקרה לצד האירועים המקומיים.

1. בגוגל יומן → הגדרות היומן → **שילוב יומן** → להעתיק את **כתובת סודית בפורמט iCal**
2. `cp .env.example .env.local` ולהדביק את הכתובת בשורה `GOOGLE_CALENDAR_ICS_URL=`
3. להפעיל מחדש את `npm run dev`

מצב החיבור מוצג ב־**הגדרות → חיבורים**. הכתובת היא סוד — היא נשארת בצד השרת
ולא נכנסת ל־git. פירוט ב־[docs/SPEC.md](docs/SPEC.md) סעיף 5.1.

## מה יש בפנים

| מסך | נתיב | תיאור |
|---|---|---|
| היום | `/` | דף הבית: משימות היום, מה שנגרר, השבוע הקרוב, מאזן החודש |
| משימות | `/tasks` | משימות פעילות עם סינון וחיפוש, וארכיון |
| יומן | `/calendar` | תצוגת חודש, פאנל יום, אירועים + משימות + אירועים מגוגל יומן |
| כספים | `/finance` | הכנסות והוצאות לפי חודש, סיכום, פילוח קטגוריות, מגמה |
| הערות ורשימות | `/notes` | רשימות לסימון, הערות |
| הגדרות | `/settings` | קטגוריות, חיבורים, גיבוי/שחזור JSON |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Zustand · date-fns · Recharts · ical.js · node:sqlite

## אחסון

מסד SQLite מקומי ב־`data/lior.db`, מאחורי שכבת API תחת `/api`. גיבוי ידני
ל־JSON דרך **הגדרות → גיבוי**, וגיבוי אוטומטי יומי ל־`data/backups/` (14 אחרונים).
המעבר ל־Firebase מתוכנן כספרינט נפרד.

## סקריפטים

```bash
npm run dev     # פיתוח
npm run build   # בנייה
npm run start   # הרצת הבנייה
npm run lint    # ESLint
npm test        # Vitest
npm run test:e2e  # Playwright: צילומי מסך, נגישות (axe) וזרימות, על בנייה ומסד נפרד
```
