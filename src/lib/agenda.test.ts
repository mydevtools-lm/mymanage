import { describe, expect, it } from "vitest";
import { buildDayAgenda, dayProgress } from "./agenda";
import type { CalendarEvent, Task } from "./types";
import type { ExternalEvent } from "./use-google-events";

const TODAY = "2026-09-28";
const stamp = "2026-09-20T00:00:00.000Z";

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    priority: "normal",
    completed: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  };
}

function event(id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    title: id,
    date: TODAY,
    allDay: false,
    color: "teal",
    createdAt: stamp,
    ...extra,
  };
}

function google(id: string, extra: Partial<ExternalEvent> = {}): ExternalEvent {
  return {
    id,
    title: id,
    date: TODAY,
    allDay: false,
    source: "google",
    calendarId: "1",
    ...extra,
  };
}

const build = (input: {
  tasks?: Task[];
  events?: CalendarEvent[];
  googleEvents?: ExternalEvent[];
  date?: string;
}) =>
  buildDayAgenda({
    date: input.date ?? TODAY,
    today: TODAY,
    tasks: input.tasks ?? [],
    events: input.events ?? [],
    googleEvents: input.googleEvents ?? [],
  });

describe("buildDayAgenda", () => {
  // The case that started sprint מ3: two events on 28.09 and a screen that
  // said nothing was scheduled.
  it("shows the day's events, which the old daily screen left out", () => {
    const agenda = build({
      events: [
        event("חממה", { allDay: true }),
        event("ארוחת צהריים משפחתית", { allDay: true }),
      ],
    });
    expect(agenda.allDay.map((i) => i.key)).toEqual([
      "חממה",
      "ארוחת צהריים משפחתית",
    ]);
  });

  it("puts events without a start time in the all-day strip", () => {
    const agenda = build({ events: [event("x", { startTime: undefined })] });
    expect(agenda.allDay).toHaveLength(1);
    expect(agenda.timeline).toHaveLength(0);
  });

  it("orders local events, Google events and timed tasks by time", () => {
    const agenda = build({
      events: [event("lunch", { startTime: "13:00" })],
      googleEvents: [google("standup", { startTime: "08:00" })],
      tasks: [task("call bank", { dueDate: TODAY, dueTime: "10:30" })],
    });
    expect(agenda.timeline.map((i) => i.key)).toEqual([
      "standup",
      "call bank",
      "lunch",
    ]);
  });

  it("at the same minute, appointments come before tasks", () => {
    const agenda = build({
      tasks: [task("t", { dueDate: TODAY, dueTime: "09:00" })],
      events: [event("e", { startTime: "09:00" })],
    });
    expect(agenda.timeline.map((i) => i.kind)).toEqual(["event", "task"]);
  });

  it("keeps untimed tasks out of the timeline", () => {
    const agenda = build({ tasks: [task("t", { dueDate: TODAY })] });
    expect(agenda.untimedTasks.map((t) => t.id)).toEqual(["t"]);
    expect(agenda.timeline).toHaveLength(0);
  });

  it("ignores other days and archived tasks", () => {
    const agenda = build({
      events: [event("tomorrow", { date: "2026-09-29", startTime: "09:00" })],
      tasks: [task("done", { dueDate: TODAY, archivedAt: stamp })],
    });
    expect(agenda.timeline).toHaveLength(0);
    expect(agenda.untimedTasks).toHaveLength(0);
  });

  it("carries over past-due work and lists undated tasks — today only", () => {
    const tasks = [
      task("late", { dueDate: "2026-09-20" }),
      task("later", { dueDate: "2026-09-25" }),
      task("undated"),
    ];
    const today = build({ tasks });
    expect(today.carriedOver.map((t) => t.id)).toEqual(["late", "later"]);
    expect(today.undated.map((t) => t.id)).toEqual(["undated"]);

    const tomorrow = build({ tasks, date: "2026-09-29" });
    expect(tomorrow.carriedOver).toHaveLength(0);
    expect(tomorrow.undated).toHaveLength(0);
  });

  it("counts tasks ticked off on the day", () => {
    const agenda = build({
      tasks: [
        task("a", {
          archivedAt: `${TODAY}T08:00:00.000Z`,
          completedAt: `${TODAY}T08:00:00.000Z`,
        }),
        task("b", {
          archivedAt: "2026-09-27T08:00:00.000Z",
          completedAt: "2026-09-27T08:00:00.000Z",
        }),
      ],
    });
    expect(agenda.doneCount).toBe(1);
  });
});

describe("day boundaries", () => {
  // Regression: completion times are UTC. 22:30Z on the 27th is 01:30 on the
  // 28th in Israel, and slicing the ISO string counted it on the 27th.
  it("counts a task ticked at 01:30 local time on the local day", () => {
    const agenda = build({
      tasks: [
        task("night", {
          archivedAt: "2026-09-27T22:30:00.000Z",
          completedAt: "2026-09-27T22:30:00.000Z",
        }),
      ],
    });
    expect(agenda.doneCount).toBe(1);
    expect(
      build({ tasks: agenda.carriedOver, date: "2026-09-27" }).doneCount,
    ).toBe(0);
  });
});

describe("dayProgress", () => {
  it("counts timed, untimed and carried-over tasks, but not undated ones", () => {
    const agenda = build({
      tasks: [
        task("timed", { dueDate: TODAY, dueTime: "10:00" }),
        task("untimed", { dueDate: TODAY }),
        task("late", { dueDate: "2026-09-01" }),
        task("undated"),
        task("done", {
          archivedAt: `${TODAY}T09:00:00.000Z`,
          completedAt: `${TODAY}T09:00:00.000Z`,
        }),
      ],
    });
    expect(dayProgress(agenda)).toEqual({ done: 1, total: 4, ratio: 0.25 });
  });

  it("is zero, not NaN, on an empty day", () => {
    expect(dayProgress(build({})).ratio).toBe(0);
  });
});

describe("hand-picked order", () => {
  it("puts untimed tasks in their saved order, unplaced ones last", () => {
    const day = "2026-09-28";
    const task = (id: string, position?: number) =>
      ({
        id,
        title: id,
        dueDate: day,
        priority: "normal",
        completed: false,
        position,
        createdAt: "",
        updatedAt: "",
      }) as Task;
    const agenda = buildDayAgenda({
      date: day,
      today: day,
      tasks: [task("c"), task("b", 1), task("a", 0)],
      events: [],
      googleEvents: [],
    });
    expect(agenda.untimedTasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
