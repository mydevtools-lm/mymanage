/** The first run and the sample-data banner. `he` has the shape of `en`. */

export const en = {
  languageTitle: "Choose a language",
  languageHint: "You can change it later in Settings › Preferences.",
  welcome: (app: string) => `Welcome to ${app}`,
  threeQuestions: "Three quick questions, and you're ready.",
  nameLabel: "What should we call you?",
  later: "Later",
  next: "Continue",
  startTitle: "Start empty or with sample data?",
  startHint:
    "The sample is a few tasks, events and transactions, to see how everything looks. It's removed with one click.",
  startEmpty: "Start empty",
  withSample: "With sample data",
  sampleFailed: "Couldn't add the sample data",
  backupTitle: "Have a backup?",
  backupHint:
    "A JSON file downloaded from Settings › Backup is imported there, and replaces what's here.",
  importBackup: "Import a backup",
  noBackup: "No, let's start",
  sampleShown: "Showing sample data.",
  removeSample: "Remove the sample",
  sampleRemoved: "Sample data removed",
  removeFailed: "Couldn't remove it",
};

export const he: typeof en = {
  languageTitle: "בחירת שפה",
  languageHint: "אפשר לשנות אחר כך בהגדרות › העדפות.",
  welcome: (app) => `ברוכים הבאים ל‑${app}`,
  threeQuestions: "שלוש שאלות קצרות, ואפשר להתחיל.",
  nameLabel: "איך לקרוא לך?",
  later: "אחר כך",
  next: "המשך",
  startTitle: "להתחיל ריק או עם נתוני דוגמה?",
  startHint:
    "הדוגמה היא כמה משימות, אירועים ותנועות כדי לראות איך הכול נראה. אפשר למחוק אותה בלחיצה אחת.",
  startEmpty: "להתחיל ריק",
  withSample: "עם נתוני דוגמה",
  sampleFailed: "לא הצלחנו להוסיף את נתוני הדוגמה",
  backupTitle: "יש לך גיבוי?",
  backupHint: "קובץ JSON שהורד מהגדרות › גיבוי נטען משם, ומחליף את מה שכאן.",
  importBackup: "לייבוא גיבוי",
  noBackup: "אין, מתחילים",
  sampleShown: "מוצגים נתוני דוגמה.",
  removeSample: "למחוק את הדוגמה",
  sampleRemoved: "נתוני הדוגמה נמחקו",
  removeFailed: "המחיקה נכשלה",
};
