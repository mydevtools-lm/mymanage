/**
 * Ids and calendar keys for rows. Plain functions, so the server and the
 * desktop app make them the same way.
 */

export function newId() {
  return crypto.randomUUID();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Local calendar values, not UTC: at 01:00 in Israel on the 1st of the month
// toISOString() still reports the previous month.
export function localMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function localDateKey(date = new Date()) {
  return `${localMonthKey(date)}-${pad(date.getDate())}`;
}
