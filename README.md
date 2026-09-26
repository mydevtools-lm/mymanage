# Lior Management

מערכת ניהול אישית מקומית: משימות, יומן, ניהול כללי וכספים חודשיים.
האפיון המלא נמצא ב־[docs/SPEC.md](docs/SPEC.md), ותוכנית ההמשך ב־[docs/SPRINTS.md](docs/SPRINTS.md).

## הרצה

```bash
npm install
npm run dev
```

הדפדפן: `http://localhost:3000`.

## מה יש בפנים

| מסך | נתיב | תיאור |
|---|---|---|
| לוח בקרה | `/` | משימות להיום, השבוע ביומן, מאזן החודש, הוספה מהירה |
| משימות | `/tasks` | רשימה עם סינון לפי סטטוס / עדיפות / קטגוריה / חיפוש |
| יומן | `/calendar` | תצוגת חודש, פאנל יום, אירועים + משימות עם תאריך יעד |
| כספים | `/finance` | הכנסות והוצאות לפי חודש, סיכום, פילוח קטגוריות, מגמה |
| ניהול כללי | `/manage` | הערות, קטגוריות, גיבוי/שחזור JSON |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Zustand · date-fns · Recharts

## אחסון

הנתונים נשמרים ב־`localStorage` של הדפדפן. גיבוי ידני דרך **ניהול כללי → גיבוי**.

## סקריפטים

```bash
npm run dev     # פיתוח
npm run build   # בנייה
npm run start   # הרצת הבנייה
npm run lint    # ESLint
```
