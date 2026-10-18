/** Messages for this area; `he` has exactly the shape of `en`. */

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const en = {
  /** Errors the API answers with; the screens show them in toasts. */
  api: {
    notFound: "Not found",
    notJson: "The request body isn't valid JSON",
    serverFailed: "The action failed on the server",
    badFile: "Invalid file",
    badDate: "Invalid date",
    idsRequired: "A list of IDs is required",
    titleOrRepeatMissing: "A title or a repeat is missing",
    transactionsRequired: "A list of transactions is required",
    listNameRequired: "The list needs a name",
    nameOrKindMissing: "A name or a type is missing",
    badLink: "Invalid link",
    nothingToUpdate: "Nothing to update",
    unsupported: "Unsupported action",
    textRequired: "Text is required",
    error: (status: number) => `Error (${status})`,
  },
  calendars: {
    /** The name a calendar shows when settings give none. */
    defaultName: (id: string) =>
      id === "1" ? "Google Calendar" : `Calendar ${id}`,
    badRange: "Invalid date range",
    allFailedEnv:
      "Couldn't read the calendar from Google. Check the address in .env.local",
    allFailedSettings:
      "Couldn't read the calendar from Google. Check the address in Settings › Connections",
    someFailed: (names: string[]) => `Couldn't read: ${names.join(", ")}`,
  },
  untitledEvent: "(No title)",
  search: {
    archived: "Archived",
    routine: "Recurring task",
    note: "Note",
    inList: (item: string) => `In the list: ${item}`,
    items: (count: number) => plural(count, "item", "items"),
  },
  colors: {
    teal: "Teal",
    coral: "Coral",
    lavender: "Lavender",
    amber: "Amber",
    sky: "Sky",
    mint: "Mint",
    rose: "Pink",
    slate: "Gray",
  },
  store: {
    saveFailed: "Couldn't save",
    undo: "Undo",
    migrated: (count: number) =>
      `${plural(count, "item", "items")} moved from the browser to the database`,
    loadFailed: "Couldn't load the data from the server",
    postponed: "Moved to tomorrow",
    tasksDone: (count: number) =>
      `${plural(count, "task", "tasks")} marked as done`,
    tasksDeleted: (count: number) =>
      `${plural(count, "task", "tasks")} deleted`,
    taskDeleted: "Task deleted",
    routinePaused: "Paused — it won't show up until you resume it",
    routineResumed: "Resumed",
    routineDeleted: "Recurring task deleted",
    eventDeleted: "Event deleted",
    occurrenceDeleted: "Occurrence deleted",
    occurrencesDeleted: "Occurrences from here on deleted",
    transactionsImported: (count: number) =>
      `${plural(count, "transaction", "transactions")} imported`,
    transactionDeleted: "Transaction deleted",
    monthRemoved: "This month was removed from the series",
    seriesStopped: "The series stops from this month",
    noteDeleted: "Note deleted",
    itemRemoved: (text: string) => `“${text}” removed`,
    listReset: (title: string) => `“${title}” is ready again`,
  },
};

export const he: typeof en = {
  api: {
    notFound: "לא נמצא",
    notJson: "גוף הבקשה אינו JSON תקין",
    serverFailed: "הפעולה נכשלה בצד השרת",
    badFile: "קובץ לא תקין",
    badDate: "תאריך לא תקין",
    idsRequired: "צריך רשימת מזהים",
    titleOrRepeatMissing: "חסרים כותרת או תדירות",
    transactionsRequired: "צריך רשימת תנועות",
    listNameRequired: "צריך שם לרשימה",
    nameOrKindMissing: "חסר שם או סוג",
    badLink: "קישור לא תקין",
    nothingToUpdate: "אין מה לעדכן",
    unsupported: "פעולה לא נתמכת",
    textRequired: "צריך טקסט",
    error: (status) => `שגיאה (${status})`,
  },
  calendars: {
    defaultName: (id) => (id === "1" ? "גוגל יומן" : `יומן ${id}`),
    badRange: "טווח תאריכים לא תקין",
    allFailedEnv: "לא הצלחנו לקרוא את היומן מגוגל. בדוק את הכתובת ב-.env.local",
    allFailedSettings:
      "לא הצלחנו לקרוא את היומן מגוגל. בדוק את הכתובת בהגדרות › חיבורים",
    someFailed: (names) => `לא הצלחנו לקרוא את: ${names.join(", ")}`,
  },
  untitledEvent: "(ללא כותרת)",
  search: {
    archived: "בארכיון",
    routine: "משימה קבועה",
    note: "הערה",
    inList: (item) => `ברשימה: ${item}`,
    items: (count) => `${count} פריטים`,
  },
  colors: {
    teal: "טורקיז",
    coral: "אלמוג",
    lavender: "לבנדר",
    amber: "ענבר",
    sky: "תכלת",
    mint: "מנטה",
    rose: "ורוד",
    slate: "אפור",
  },
  store: {
    saveFailed: "השמירה נכשלה",
    undo: "בטל",
    migrated: (count) => `${count} פריטים הועברו מהדפדפן למסד הנתונים`,
    loadFailed: "לא הצלחנו לטעון את הנתונים מהשרת",
    postponed: "נדחה למחר",
    tasksDone: (count) => `${count} משימות סומנו כבוצעו`,
    tasksDeleted: (count) => `${count} משימות נמחקו`,
    taskDeleted: "המשימה נמחקה",
    routinePaused: "הושהתה — לא תופיע עד שתחודש",
    routineResumed: "חודשה",
    routineDeleted: "המשימה הקבועה נמחקה",
    eventDeleted: "האירוע נמחק",
    occurrenceDeleted: "המופע נמחק",
    occurrencesDeleted: "המופעים מכאן והלאה נמחקו",
    transactionsImported: (count) => `${count} תנועות יובאו`,
    transactionDeleted: "התנועה נמחקה",
    monthRemoved: "החודש הוסר מהסדרה",
    seriesStopped: "הסדרה הופסקה מהחודש הזה",
    noteDeleted: "ההערה נמחקה",
    itemRemoved: (text) => `״${text}״ הוסר`,
    listReset: (title) => `״${title}״ מוכנה מחדש`,
  },
};
