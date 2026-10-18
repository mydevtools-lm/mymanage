/** "Add in a sentence" (smart-add.tsx). `he` has exactly the shape of `en`. */

export const en = {
  title: "Add in a sentence",
  description:
    "Write it the way you'd say it — “Monday gym, then lunch with Dana”. Before anything is saved, you see what was understood and can fix it.",
  input: "What to add",
  read: "What did you get?",
  reading: "Reading…",
  readAgain: "Read again",
  failed: "Couldn't read that",
  nothingFound: "I couldn't find anything to add here.",
  claudeFound: (n: number) =>
    n === 1 ? "Claude understood 1 item" : `Claude understood ${n} items`,
  localFound: (n: number) =>
    `Understood ${n === 1 ? "1 item" : `${n} items`} (local reading — smarter with a Claude key)`,
  include: (title: string) => `Add ${title}`,
  kind: "Type",
  kinds: { task: "Task", event: "Event", transaction: "Transaction" },
  itemTitle: "Title",
  date: "Date",
  time: "Time",
  amount: "Amount",
  direction: "Expense or income",
  expense: "Expense",
  income: "Income",
  added: (n: number) => (n === 1 ? "1 item added" : `${n} items added`),
  addCount: (n: number) => (n > 0 ? `Add (${n})` : "Add"),
};

export const he: typeof en = {
  title: "הוספה במשפט",
  description:
    "כותבים כמו שמדברים — ״ביום שני חממה ואחרי זה ארוחת צהריים״. לפני שנשמר משהו, רואים מה הובן ואפשר לתקן.",
  input: "מה להוסיף",
  read: "מה הבנת?",
  reading: "קורא…",
  readAgain: "קריאה מחדש",
  failed: "הפענוח נכשל",
  nothingFound: "לא הצלחתי למצוא כאן משהו להוסיף.",
  claudeFound: (n) => `Claude הבין ${n} פריטים`,
  localFound: (n) =>
    `הובנו ${n} פריטים (קריאה מקומית — עם מפתח Claude היא חכמה יותר)`,
  include: (title) => `להוסיף את ${title}`,
  kind: "סוג",
  kinds: { task: "משימה", event: "אירוע", transaction: "תנועה" },
  itemTitle: "כותרת",
  date: "תאריך",
  time: "שעה",
  amount: "סכום",
  direction: "הוצאה או הכנסה",
  expense: "הוצאה",
  income: "הכנסה",
  added: (n) => (n === 1 ? "נוסף פריט אחד" : `נוספו ${n} פריטים`),
  addCount: (n) => (n > 0 ? `הוספה (${n})` : "הוספה"),
};
