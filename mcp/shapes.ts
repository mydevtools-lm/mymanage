import type {
  CalendarEvent,
  Category,
  Checklist,
  Routine,
  Task,
} from "../src/lib/types";

/** How items look in a tool's answer, the same for reading and for writing. */

export function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function categoryName(categories: Category[], id: string | undefined) {
  return id ? (categories.find((c) => c.id === id)?.name ?? null) : null;
}

export function shapeTask(task: Task, categories: Category[]) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    category: categoryName(categories, task.categoryId),
    reminder: task.reminder,
    completed: task.completed,
    completedAt: task.completedAt,
    archived: !!task.archivedAt,
    subtasks: task.subtasks?.map((s) => ({
      id: s.id,
      text: s.text,
      done: s.done,
    })),
  };
}

export function shapeRoutine(routine: Routine, categories: Category[]) {
  return {
    id: routine.id,
    title: routine.title,
    description: routine.description,
    priority: routine.priority,
    category: categoryName(categories, routine.categoryId),
    dueTime: routine.dueTime,
    repeat: routine.repeat,
    startDate: routine.startDate,
    paused: !!routine.paused,
  };
}

/** One event as shown on a day. For a repeating one, `id` is the series and
 *  `occurrenceDate` is the day to name when changing just this occurrence. */
export function shapeEvent(event: CalendarEvent) {
  return {
    id: event.seriesId ?? event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
    location: event.location,
    notes: event.notes,
    color: event.color,
    reminder: event.reminder,
    repeat: event.repeat,
    until: event.until,
    occurrenceDate: event.occurrenceDate,
  };
}

export function shapeChecklist(list: Checklist) {
  return {
    id: list.id,
    title: list.title,
    pinned: !!list.pinned,
    items: list.items.map((item) => ({
      id: item.id,
      text: item.text,
      done: item.done,
    })),
  };
}
