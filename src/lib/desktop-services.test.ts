import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { desktopCalendars, desktopParse, setSecret } from "./desktop-services";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
SUMMARY:יום הולדת
END:VEVENT
END:VCALENDAR`;

/** What Rust would answer, by command. */
function rust(answers: Record<string, (args: Record<string, unknown>) => unknown>) {
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    const answer = answers[command];
    if (!answer) throw new Error(`unexpected ${command}`);
    return answer(args ?? {});
  });
}

beforeEach(async () => {
  invoke.mockReset();
  // Empties the feed cache between tests.
  rust({ secret_set: () => null });
  await setSecret("anthropic", "");
});

describe("desktopCalendars", () => {
  it("reads every connected calendar and keeps the rest when one fails", async () => {
    rust({
      secret_status: () => ({ calendars: ["1", "2"], claude: false }),
      calendar_fetch: ({ id }) => {
        if (id === "2") throw "Google Calendar 2 returned 404";
        return ICS;
      },
    });
    const result = await desktopCalendars("2026-10-01", "2026-10-31");
    expect(result.configured).toBe(true);
    expect(result.calendars).toEqual([
      { id: "1", name: "גוגל יומן" },
      { id: "2", name: "יומן 2", failed: true },
    ]);
    expect(result.events.map((e) => e.id)).toEqual(["google:1:abc:once"]);
    expect(result.error).toBe("לא הצלחנו לקרוא את: יומן 2");
  });

  it("downloads a feed once for ten minutes, across date windows", async () => {
    rust({
      secret_status: () => ({ calendars: ["1"], claude: false }),
      calendar_fetch: () => ICS,
    });
    await desktopCalendars("2026-10-01", "2026-10-31");
    await desktopCalendars("2026-09-01", "2026-09-30");
    expect(invoke.mock.calls.filter(([c]) => c === "calendar_fetch")).toHaveLength(1);
  });

  it("is not connected when no calendar has an address", async () => {
    rust({ secret_status: () => ({ calendars: [], claude: false }) });
    expect(await desktopCalendars("2026-10-01", "2026-10-31")).toEqual({
      configured: false,
      calendars: [],
      events: [],
    });
  });
});

describe("desktopParse", () => {
  it("uses the local rules when there is no key", async () => {
    rust({ secret_status: () => ({ calendars: [], claude: false }) });
    expect(await desktopParse("מחר חממה", "2026-09-27")).toEqual({
      source: "local",
      proposals: [{ kind: "event", title: "חממה", date: "2026-09-28" }],
    });
  });

  it("asks Claude through Rust, and the page never holds the key", async () => {
    rust({
      secret_status: () => ({ calendars: [], claude: true }),
      assist_parse: () => ({
        content: [
          {
            type: "tool_use",
            input: { items: [{ kind: "task", title: "להתקשר לרופא" }] },
          },
        ],
      }),
    });
    expect(await desktopParse("להתקשר לרופא", "2026-09-27")).toEqual({
      source: "claude",
      proposals: [{ kind: "task", title: "להתקשר לרופא" }],
    });
    const [, args] = invoke.mock.calls.find(([c]) => c === "assist_parse")!;
    expect(args.body).toMatchObject({
      tool_choice: { type: "tool", name: "propose_items" },
      messages: [{ role: "user", content: "להתקשר לרופא" }],
    });
    expect(JSON.stringify(args)).not.toMatch(/x-api-key/i);
  });

  it("falls back to the local rules when Claude fails", async () => {
    rust({
      secret_status: () => ({ calendars: [], claude: true }),
      assist_parse: () => {
        throw "Claude API 401";
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await desktopParse("מחר חממה", "2026-09-27")).source).toBe("local");
  });
});
