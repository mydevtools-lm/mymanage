import { describe, expect, it } from "vitest";
import { calendarSources, parseEvents } from "./google-calendar";

describe("calendarSources", () => {
  it("reads the first calendar and numbered extras, in order", () => {
    const sources = calendarSources({
      GOOGLE_CALENDAR_ICS_URL: " https://a.example/basic.ics ",
      GOOGLE_CALENDAR_ICS_URL_3: "https://c.example/basic.ics",
      GOOGLE_CALENDAR_NAME_3: "עבודה",
      GOOGLE_CALENDAR_ICS_URL_2: "",
    });
    expect(sources).toEqual([
      { id: "1", name: "גוגל יומן", url: "https://a.example/basic.ics" },
      { id: "3", name: "עבודה", url: "https://c.example/basic.ics" },
    ]);
  });

  it("is empty when nothing is set", () => {
    expect(calendarSources({})).toEqual([]);
  });
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:abc
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
SUMMARY:יום הולדת
END:VEVENT
END:VCALENDAR`;

describe("parseEvents", () => {
  it("tags each event with its calendar, in the id too", () => {
    const [event] = parseEvents(ICS, "2026-10-01", "2026-10-31", "2");
    expect(event).toMatchObject({
      title: "יום הולדת",
      date: "2026-10-03",
      allDay: true,
      calendarId: "2",
    });
    // Two calendars can share an event (an invite); ids must not collide.
    expect(event.id).toBe("google:2:abc:once");
  });
});

describe("times", () => {
  // Regression: UTC times ("…Z", which Google uses) were shown as UTC, so a
  // 13:00 meeting in Israel appeared at 10:00.
  it("shows a UTC time in local time", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:utc
DTSTART:20260928T100000Z
DTEND:20260928T110000Z
SUMMARY:פגישה
END:VEVENT
END:VCALENDAR`;
    // Tests run in Asia/Jerusalem (vitest.config.mts): UTC+3 in September.
    const [event] = parseEvents(ics, "2026-09-28", "2026-09-28");
    expect(event).toMatchObject({ startTime: "13:00", endTime: "14:00" });
  });

  it("moves a late-evening UTC time to the next local day", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:late
DTSTART:20260928T220000Z
DTEND:20260928T230000Z
SUMMARY:לילה
END:VEVENT
END:VCALENDAR`;
    const [event] = parseEvents(ics, "2026-09-29", "2026-09-29");
    expect(event).toMatchObject({ date: "2026-09-29", startTime: "01:00" });
  });
});

describe("times with a named zone", () => {
  it("converts from the event's zone to local time", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:ny
DTSTART;TZID=America/New_York:20260928T090000
DTEND;TZID=America/New_York:20260928T100000
SUMMARY:שיחה עם ניו יורק
END:VEVENT
END:VCALENDAR`;
    // 09:00 EDT (UTC-4) is 16:00 in Israel (UTC+3).
    const [event] = parseEvents(ics, "2026-09-28", "2026-09-28");
    expect(event).toMatchObject({ startTime: "16:00", endTime: "17:00" });
  });
});
