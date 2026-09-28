import { describe, expect, it } from "vitest";
import { expandEvents, planEventDelete, planEventEdit } from "./event-series";
import type { CalendarEvent } from "./types";

// 2026-09-28 is a Monday.
const gym: CalendarEvent = {
  id: "gym",
  title: "חדר כושר",
  date: "2026-09-28",
  startTime: "18:00",
  endTime: "19:00",
  allDay: false,
  color: "teal",
  repeat: { kind: "weekly", days: [1, 3] }, // Mon, Wed
  createdAt: "",
};

const days = (list: CalendarEvent[]) => list.map((e) => e.date);

describe("expandEvents", () => {
  it("leaves one-off events alone, inside the window only", () => {
    const once = { ...gym, id: "once", repeat: undefined };
    expect(expandEvents([once], "2026-09-01", "2026-09-30")).toEqual([once]);
    expect(expandEvents([once], "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("repeats on the chosen days, from the start, up to `until`", () => {
    const shown = expandEvents(
      [{ ...gym, until: "2026-10-07" }],
      "2026-09-20",
      "2026-10-31",
    );
    expect(days(shown)).toEqual([
      "2026-09-28",
      "2026-09-30",
      "2026-10-05",
      "2026-10-07",
    ]);
    expect(shown[1]).toMatchObject({
      id: "gym@2026-09-30",
      seriesId: "gym",
      occurrenceDate: "2026-09-30",
    });
  });

  it("skips a cancelled day and applies a changed one", () => {
    const shown = expandEvents(
      [
        {
          ...gym,
          exceptions: [
            { date: "2026-09-30", skip: true },
            { date: "2026-10-05", startTime: "07:00", title: "בוקר" },
          ],
        },
      ],
      "2026-09-28",
      "2026-10-05",
    );
    expect(days(shown)).toEqual(["2026-09-28", "2026-10-05"]);
    expect(shown[1]).toMatchObject({ startTime: "07:00", title: "בוקר" });
  });

  it("shows a moved occurrence on its new day, in or out of the window", () => {
    const moved = {
      ...gym,
      exceptions: [{ date: "2026-09-30", newDate: "2026-10-02" }],
    };
    // Original day in the window, new day outside it: not shown.
    expect(days(expandEvents([moved], "2026-09-28", "2026-10-01"))).toEqual([
      "2026-09-28",
    ]);
    // New day in the window, original day outside it: shown.
    const shown = expandEvents([moved], "2026-10-02", "2026-10-04");
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({
      date: "2026-10-02",
      occurrenceDate: "2026-09-30",
    });
  });
});

describe("planEventDelete", () => {
  it("this: skips the day", () => {
    expect(planEventDelete(gym, "2026-09-30", "this")).toEqual({
      kind: "update",
      id: "gym",
      patch: { exceptions: [{ date: "2026-09-30", skip: true }] },
    });
  });

  it("following: ends the day before, dropping later changes", () => {
    const plan = planEventDelete(
      {
        ...gym,
        exceptions: [
          { date: "2026-09-30", title: "x" },
          { date: "2026-10-12", title: "y" },
        ],
      },
      "2026-10-05",
      "following",
    );
    expect(plan).toEqual({
      kind: "update",
      id: "gym",
      patch: {
        until: "2026-10-04",
        exceptions: [{ date: "2026-09-30", title: "x" }],
      },
    });
  });

  it("following from the first day, or all: deletes the row", () => {
    expect(planEventDelete(gym, "2026-09-28", "following").kind).toBe("delete");
    expect(planEventDelete(gym, "2026-10-05", "all").kind).toBe("delete");
  });
});

describe("planEventEdit", () => {
  it("this: records the change for that day only, including a move", () => {
    const plan = planEventEdit(gym, "2026-09-30", "this", {
      date: "2026-10-01",
      startTime: "20:00",
      title: "חדר כושר",
    });
    expect(plan).toEqual({
      kind: "update",
      id: "gym",
      patch: {
        exceptions: [
          {
            date: "2026-09-30",
            newDate: "2026-10-01",
            startTime: "20:00",
            title: "חדר כושר",
          },
        ],
      },
    });
    const shown = expandEvents(
      [{ ...gym, ...(plan.kind === "update" ? plan.patch : {}) }],
      "2026-09-28",
      "2026-10-04",
    );
    expect(days(shown)).toEqual(["2026-09-28", "2026-10-01"]);
  });

  it("all: moving one occurrence by a day moves the series by a day", () => {
    const plan = planEventEdit(gym, "2026-10-05", "all", {
      date: "2026-10-06",
      startTime: "17:00",
    });
    expect(plan).toEqual({
      kind: "update",
      id: "gym",
      patch: { date: "2026-09-29", startTime: "17:00" },
    });
  });

  it("following: splits into the old series and a new one from that day", () => {
    const plan = planEventEdit(gym, "2026-10-05", "following", {
      startTime: "19:00",
      endTime: "20:00",
    });
    expect(plan.kind).toBe("split");
    if (plan.kind !== "split") return;
    expect(plan.patch).toEqual({ until: "2026-10-04", exceptions: [] });
    expect(plan.create).toMatchObject({
      date: "2026-10-05",
      startTime: "19:00",
      repeat: gym.repeat,
    });
    // Together they cover the same days, with the new time from the split on.
    const shown = expandEvents(
      [
        { ...gym, ...plan.patch },
        { ...plan.create, id: "gym2", createdAt: "" },
      ],
      "2026-09-28",
      "2026-10-08",
    );
    expect(shown.map((e) => `${e.date} ${e.startTime}`).sort()).toEqual([
      "2026-09-28 18:00",
      "2026-09-30 18:00",
      "2026-10-05 19:00",
      "2026-10-07 19:00",
    ]);
  });

  it("a one-off event is simply updated", () => {
    const once = { ...gym, repeat: undefined };
    expect(planEventEdit(once, once.date, "this", { title: "x" })).toEqual({
      kind: "update",
      id: "gym",
      patch: { title: "x" },
    });
  });
});
