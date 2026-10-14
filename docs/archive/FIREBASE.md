# מעבר ל‑Firebase — מה צריך ממך

> **בארכיון.** ספרינט Firebase מוקפא לפי החלטה ה2 ב‑[DESKTOP.md](../DESKTOP.md): האפליקציה מקומית. המסמך נשאר לסנכרון רשות בעתיד.

ספרינט 1 ב‑[SPRINTS.md](SPRINTS.md). כל השאר בתוכנית נבנה; זה הפריט שחסום,
כי יצירת חשבונות ופרויקטים נעשית רק על ידך. המסמך הזה אומר בדיוק מה לעשות,
ומה קורה אחרי.

## קודם — שלוש החלטות

| # | שאלה | המלצה |
|---|---|---|
| 1 | Firestore או Realtime Database | **Firestore** |
| 2 | איפה המערכת רצה | **מתארחת בענן** (Firebase App Hosting או Vercel) — בלי זה אין גישה מהטלפון |
| 3 | מה קורה ל‑SQLite | **יוצא משימוש**, נשאר ייצוא JSON כגיבוי |

תשובה של שורה מספיקה (למשל ״כמו ההמלצות״).

## בקונסולה — כ‑10 דקות

1. [console.firebase.google.com](https://console.firebase.google.com) › **Add
   project**. שם: למשל `lior-management`. Google Analytics — לא צריך.
2. **Build › Firestore Database › Create database**. מיקום: `me-west1`
   (תל אביב). מצב: **production** — הכללים בקובץ `firestore.rules` כבר סגורים.
3. **Build › Authentication › Get started › Google** › Enable. כתובת תמיכה:
   המייל שלך.
4. **Project settings › General › Your apps › Web (`</>`)**. שם: `web`. בלי
   Hosting בשלב הזה. יוצג אובייקט `firebaseConfig`.
5. להעתיק את הערכים ל‑`.env.local` (אלה לא סודות — הם מזהים ציבוריים של
   הפרויקט; ההגנה היא הכללים):

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```

6. להגיד לי שזה מוכן.

## מה אני עושה אחרי

- מחבר התחברות עם Google, ואחרי הכניסה הראשונה שלך — מכניס את ה‑uid שלך
  ל‑`firestore.rules` במקום `OWNER_UID`, כך שרק החשבון שלך יכול לקרוא ולכתוב
- מחליף את `src/lib/store.ts` ל‑Firestore עם האזנה בזמן אמת ומטמון לא‑מקוון.
  המסכים לא משתנים — כל מסך קורא מהמאגר כמו היום
- מעביר את הנתונים מ‑`data/lior.db`: ייצוא, העלאה, וספירה והשוואה לפני ואחרי
- בודק את הכללים מול האמולטור המקומי — שמשתמש אחר לא קורא ולא כותב כלום
- אחרי החלטה 2: אירוח, ואז הטלפון — התקנה כאפליקציה (כבר מוכן), והתראות לטלפון
  סגור (FCM, ספרינט 6)

## ומה נפתח בעקבות זה

| פריט | ספרינט | למה מחכה |
|---|---|---|
| סנכרון דו‑כיווני עם גוגל יומן | 3 | התחברות עם Google + הרשאת Calendar API בפרויקט |
| התראות לטלפון כשהמערכת סגורה | 6 | FCM, שמגיע עם הפרויקט, ואירוח |
| הוספה במשפט עם Claude | 5 | רק מפתח: `ANTHROPIC_API_KEY` ב‑`.env.local` (console.anthropic.com). בלעדיו עובדת הקריאה המקומית |
