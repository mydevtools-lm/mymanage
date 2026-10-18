/** Messages for this area; `he` has exactly the shape of `en`. */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const en = {
  addTask: "Task",
  addEvent: "Event",
  addTransaction: "Transaction",
  brief: "Brief",
  whatsOnToday: "What's on today",
  whatsOn: (date: string) => `What's on ${date}`,
  noTasksForDay: "No tasks for this day",
  tasksDone: (done: number, total: number) =>
    `${done} of ${total} ${plural(total, "task", "tasks")} done`,
  allDone: "All done",
  dayProgress: "Progress for the day",
  duringTheDay: "During the day",
  reorderTasks: "Drag to reorder the tasks",
  allPlannedDone: "Everything planned for this day is done.",
  nothingScheduled: "Nothing scheduled for this day.",
  carriedOver: "Carried over from earlier days",
  carriedOverHint: (n: number) =>
    n === 1
      ? "1 task past its date and not done"
      : `${n} tasks past their date and not done`,
  allToToday: "All to today",
  toToday: "To today",
  originalDate: (date: string) => `Originally: ${date}`,
  /** date-fns patterns. */
  dates: {
    weekdayDayMonthLong: "EEEE, MMMM d",
  },
  timeline: {
    readOnlyGoogle: "From Google Calendar — read-only",
    now: (time: string) => `Now, ${time}`,
  },
  picker: {
    previousDay: "Previous day",
    nextDay: "Next day",
    backToToday: "Back to today",
    pickDate: "Pick a date",
  },
  weekAhead: {
    title: "The week ahead",
    description: "The six days after today",
    openCalendar: "Open Calendar",
    empty: "A free week. No events or scheduled tasks.",
  },
  month: {
    balanceOf: (month: string) => `${month} balance`,
    openMoney: "Open Money",
    income: "Income",
    expenses: "Expenses",
    balance: "Balance",
  },
  briefDialog: {
    none: "None.",
    eventsToday: "Events today",
    allDay: "All day",
    fromGoogle: "From Google",
    tasksForToday: "Tasks for today",
    carriedOver: (n: number) => `Carried over from earlier days (${n})`,
    bills: "Recurring bills in the next few days",
    monthSoFar: "The month so far",
    weekFrom: (date: string) => `From ${date} to today.`,
    tasksCompleted: "Tasks completed",
    slipped: "Past their date and still open",
    spentThisWeek: "Spent this week",
    sameAsLastWeek: "Same as last week",
    moreThanLastWeek: (amount: string) =>
      `${amount} more than the same days last week`,
    lessThanLastWeek: (amount: string) =>
      `${amount} less than the same days last week`,
    morningBrief: "Morning brief",
    weekSummary: "Week summary",
  },
  /** A reminder's text: the time it is for, and how soon that is. */
  reminders: {
    now: (time: string) => `${time} · now`,
    inMinutes: (time: string, n: number) =>
      `${time} · in ${n} ${plural(n, "minute", "minutes")}`,
    inAnHour: (time: string) => `${time} · in an hour`,
    tomorrow: (time: string) => `${time} · tomorrow`,
    inHours: (time: string, n: number) =>
      `${time} · in ${n} ${plural(n, "hour", "hours")}`,
  },
  greetings: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    night: "Good night",
  },
};

export const he: typeof en = {
  addTask: "משימה",
  addEvent: "אירוע",
  addTransaction: "תנועה",
  brief: "תדריך",
  whatsOnToday: "מה יש היום",
  whatsOn: (date) => `מה יש ב־${date}`,
  noTasksForDay: "אין משימות ליום הזה",
  tasksDone: (done, total) => `${done} מתוך ${total} משימות בוצעו`,
  allDone: "הכול בוצע",
  dayProgress: "התקדמות היום",
  duringTheDay: "במהלך היום",
  reorderTasks: "גרירה לשינוי סדר המשימות",
  allPlannedDone: "כל מה שתוכנן ליום הזה בוצע.",
  nothingScheduled: "שום דבר לא מתוזמן ליום הזה.",
  carriedOver: "נגררו מימים קודמים",
  carriedOverHint: (n) => `${n} משימות שמועדן עבר ולא סומנו`,
  allToToday: "הכול להיום",
  toToday: "להיום",
  originalDate: (date) => `מועד מקורי: ${date}`,
  dates: {
    weekdayDayMonthLong: "EEEE, d בMMMM",
  },
  timeline: {
    readOnlyGoogle: "מגוגל יומן — קריאה בלבד",
    now: (time) => `עכשיו, ${time}`,
  },
  picker: {
    previousDay: "יום קודם",
    nextDay: "יום הבא",
    backToToday: "חזרה להיום",
    pickDate: "בחירת תאריך",
  },
  weekAhead: {
    title: "השבוע הקרוב",
    description: "ששת הימים שאחרי היום",
    openCalendar: "ליומן",
    empty: "שבוע פנוי. אין אירועים או משימות מתוזמנות.",
  },
  month: {
    balanceOf: (month) => `מאזן ${month}`,
    openMoney: "לכספים",
    income: "הכנסות",
    expenses: "הוצאות",
    balance: "מאזן",
  },
  briefDialog: {
    none: "אין.",
    eventsToday: "אירועים היום",
    allDay: "כל היום",
    fromGoogle: "מגוגל",
    tasksForToday: "משימות להיום",
    carriedOver: (n) => `נגררו מימים קודמים (${n})`,
    bills: "חשבונות קבועים בימים הקרובים",
    monthSoFar: "החודש עד עכשיו",
    weekFrom: (date) => `מ${date} עד היום.`,
    tasksCompleted: "משימות שהושלמו",
    slipped: "עבר מועדן ועדיין פתוחות",
    spentThisWeek: "הוצאות השבוע",
    sameAsLastWeek: "כמו בשבוע שעבר",
    moreThanLastWeek: (amount) => `${amount} יותר מאותם ימים בשבוע שעבר`,
    lessThanLastWeek: (amount) => `${amount} פחות מאותם ימים בשבוע שעבר`,
    morningBrief: "תדריך בוקר",
    weekSummary: "סיכום שבוע",
  },
  reminders: {
    now: (time) => `${time} · עכשיו`,
    inMinutes: (time, n) => `${time} · בעוד ${n} דקות`,
    inAnHour: (time) => `${time} · בעוד שעה`,
    tomorrow: (time) => `${time} · מחר`,
    inHours: (time, n) => `${time} · בעוד ${n} שעות`,
  },
  greetings: {
    morning: "בוקר טוב",
    afternoon: "צהריים טובים",
    evening: "ערב טוב",
    night: "לילה טוב",
  },
};
