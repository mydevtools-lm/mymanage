/** Messages for this area; `he` has exactly the shape of `en`. */

export const en = {
  title: "Calendar",
  newEvent: "New event",
  previous: "Previous",
  next: "Next",
  viewMonth: "Month view",
  month: "Month",
  viewWeek: "Week view",
  week: "Week",
  viewList: "List view",
  list: "List",
  legend: {
    event: "Event",
    task: "Task",
    /** Follows the struck-through word "Task". */
    taskDone: "done",
  },
  google: {
    notConnected: "Google Calendar not connected · Connect",
    loading: "Loading from Google…",
    count: (n: number) =>
      n === 1
        ? "1 event from Google in this period"
        : `${n} events from Google in this period`,
    failed: "Couldn't connect to Google Calendar",
  },
  allDay: "All day",
  recurringEvent: "Recurring event",
  agenda: {
    emptyTitle: "Nothing in this period",
    emptyHint: "Try another period, or add an event",
    dayFree: "Nothing on the calendar today.",
  },
  day: {
    counts: (events: number, google: number, tasks: number) =>
      [
        events === 1 ? "1 event" : `${events} events`,
        ...(google > 0 ? [`${google} from Google`] : []),
        tasks === 1 ? "1 task" : `${tasks} tasks`,
      ].join(" · "),
    events: "Events",
    addEvent: "Event",
    noEvents: "No events on this day.",
    googleCalendar: "Google Calendar",
    readOnly: "Read-only",
    tasks: "Tasks",
    addTask: "Task",
    noTasks: "No tasks for this day.",
  },
  toast: {
    added: "Event added",
    updated: "Event updated",
  },
  dialog: {
    editTitle: "Edit event",
    needTitle: "The event needs a title",
    needDate: "Pick a date",
    title: "Title",
    date: "Date",
    startTime: "Start time",
    endTime: "End time",
    reminder: "Reminder",
    repeat: "Repeat",
    until: "Until (optional)",
    location: "Location",
    notes: "Notes",
    color: "Color",
  },
  monthView: {
    cellLabel: (date: string, items: number) =>
      `${date} — ${items === 1 ? "1 item" : `${items} items`}`,
    more: (n: number) => `+${n} more`,
  },
  weekView: {
    newEventAt: (time: string) => `New event at ${time}`,
    googleTitle: (when: string, title: string) =>
      `${when} ${title} — from Google, read-only`,
  },
  /** date-fns patterns. */
  dates: {
    /** A day cell's label for screen readers. */
    cell: "MMM d",
  },
};

export const he: typeof en = {
  title: "יומן",
  newEvent: "אירוע חדש",
  previous: "הקודם",
  next: "הבא",
  viewMonth: "תצוגת חודש",
  month: "חודש",
  viewWeek: "תצוגת שבוע",
  week: "שבוע",
  viewList: "תצוגת רשימה",
  list: "רשימה",
  legend: {
    event: "אירוע",
    task: "משימה",
    taskDone: "הושלמה",
  },
  google: {
    notConnected: "גוגל יומן לא מחובר · לחיבור",
    loading: "טוען מגוגל…",
    count: (n) => `${n} אירועים מגוגל בתקופה זו`,
    failed: "החיבור ליומן גוגל נכשל",
  },
  allDay: "כל היום",
  recurringEvent: "אירוע חוזר",
  agenda: {
    emptyTitle: "אין כלום בתקופה הזו",
    emptyHint: "נסה תקופה אחרת, או הוסף אירוע",
    dayFree: "היום פנוי ביומן.",
  },
  day: {
    counts: (events, google, tasks) =>
      `${events} אירועים${google > 0 ? ` · ${google} מגוגל` : ""} · ${tasks} משימות`,
    events: "אירועים",
    addEvent: "אירוע",
    noEvents: "אין אירועים ביום זה.",
    googleCalendar: "גוגל יומן",
    readOnly: "קריאה בלבד",
    tasks: "משימות",
    addTask: "משימה",
    noTasks: "אין משימות ליום זה.",
  },
  toast: {
    added: "האירוע נוסף",
    updated: "האירוע עודכן",
  },
  dialog: {
    editTitle: "עריכת אירוע",
    needTitle: "צריך כותרת לאירוע",
    needDate: "צריך תאריך",
    title: "כותרת",
    date: "תאריך",
    startTime: "שעת התחלה",
    endTime: "שעת סיום",
    reminder: "תזכורת",
    repeat: "חזרה",
    until: "עד תאריך (רשות)",
    location: "מיקום",
    notes: "הערות",
    color: "צבע",
  },
  monthView: {
    cellLabel: (date, items) => `${date} — ${items} פריטים`,
    more: (n) => `+${n} נוספים`,
  },
  weekView: {
    newEventAt: (time) => `אירוע חדש ב־${time}`,
    googleTitle: (when, title) => `${when} ${title} — מגוגל, קריאה בלבד`,
  },
  dates: {
    cell: "d.M",
  },
};
