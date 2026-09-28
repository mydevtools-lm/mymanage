// Two stand-in Google calendars for the e2e run, so the whole iCal path —
// fetch, parse, several calendars, colours, hiding — runs without a real
// Google address. Events are made relative to today on every request.
import { createServer } from "node:http";

const PORT = Number(process.env.ICS_PORT ?? 3101);

function stamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function at(dayOffset, hour) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dateOnly(dayOffset) {
  const d = at(dayOffset, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function calendar(events) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//e2e//fixture//HE",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      ...(e.allDay
        ? [
            `DTSTART;VALUE=DATE:${dateOnly(e.day)}`,
            `DTEND;VALUE=DATE:${dateOnly(e.day + 1)}`,
          ]
        : [
            `DTSTART:${stamp(at(e.day, e.hour))}`,
            `DTEND:${stamp(at(e.day, e.hour + 1))}`,
          ]),
      `SUMMARY:${e.title}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
}

const FEEDS = {
  "/one.ics": () =>
    calendar([
      { uid: "g1", title: "פגישה מגוגל", day: 0, hour: 13 },
      { uid: "g2", title: "יום הולדת לדנה", day: 1, allDay: true },
    ]),
  "/two.ics": () =>
    calendar([{ uid: "w1", title: "סטנדאפ צוות", day: 0, hour: 15 }]),
};

createServer((request, response) => {
  const feed = FEEDS[request.url ?? ""];
  if (!feed) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" });
  response.end(feed());
}).listen(PORT, () => console.log(`ics fixtures on ${PORT}`));
