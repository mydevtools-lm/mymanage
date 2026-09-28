import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toJsonBody } from "./json-body";

// Capture toasts so a test can press "בטל" the way a user would.
const toasts: { label: string; undo?: () => void }[] = [];
vi.mock("sonner", () => {
  const toast = (label: string, opts?: { action?: { onClick: () => void } }) =>
    toasts.push({ label, undo: opts?.action?.onClick });
  return {
    toast: Object.assign(toast, { error: vi.fn(), success: vi.fn() }),
  };
});

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

let calls: Call[];

beforeEach(() => {
  calls = [];
  toasts.length = 0;
  vi.resetModules();
  // A slow server: every request takes 30ms, so anything done right after a
  // create lands before the create has answered.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({
        url,
        method: init.method ?? "GET",
        body: init.body ? JSON.parse(String(init.body)) : null,
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshStore() {
  const { useAppStore } = await import("./store");
  return useAppStore;
}

describe("creating and immediately acting on a row", () => {
  // Regression: new rows used a temporary "tmp-…" id until the server replied.
  // A tick in that window PATCHed an id the server had never heard of, got a
  // 404, and the tick was lost.
  it("the create and the follow-up use the same id", async () => {
    const store = await freshStore();
    store.getState().addTask({ title: "x", priority: "normal" });
    const id = store.getState().tasks[0].id;
    store.getState().toggleTask(id);

    const post = calls.find((c) => c.method === "POST");
    const patch = calls.find((c) => c.method === "PATCH");
    expect(post?.body?.id).toBe(id);
    expect(patch?.url).toBe(`/api/tasks/${id}`);
  });

  it("checklist items get their id before the server answers", async () => {
    const store = await freshStore();
    store.getState().addChecklist("קניות", ["שמן בישול"]);
    const list = store.getState().checklists[0];
    store.getState().addChecklistItem(list.id, "אקונומיקה");
    const item = store.getState().checklists[0].items[1];
    store.getState().toggleChecklistItem(list.id, item.id);

    const tick = calls.find((c) => c.url.includes("/items/"));
    expect(tick?.url).toBe(`/api/checklists/${list.id}/items/${item.id}`);
  });
});

describe("clearing a field", () => {
  // Regression: JSON.stringify drops undefined, so "clear archivedAt" never
  // reached the server and the task came back archived after a reload.
  it("restore from the archive sends archivedAt: null", async () => {
    const store = await freshStore();
    store.setState({
      tasks: [
        {
          id: "t",
          title: "x",
          priority: "normal",
          completed: true,
          completedAt: "2026-09-28T09:00:00.000Z",
          archivedAt: "2026-09-28T09:00:00.000Z",
          createdAt: "2026-09-28T08:00:00.000Z",
          updatedAt: "2026-09-28T09:00:00.000Z",
        },
      ],
    });
    store.getState().restoreTask("t");

    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toMatchObject({
      archivedAt: null,
      completedAt: null,
      completed: false,
    });
  });
});

describe("toJsonBody", () => {
  it("turns undefined into null so the key survives", () => {
    expect(JSON.stringify({ a: undefined })).toBe("{}");
    expect(toJsonBody({ a: undefined, b: 1 })).toBe('{"a":null,"b":1}');
  });

  it("works on nested values", () => {
    expect(toJsonBody({ r: { endMonth: undefined } })).toBe(
      '{"r":{"endMonth":null}}',
    );
  });
});

describe("recurring series", () => {
  it("deleting one month skips it instead of deleting the series", async () => {
    const store = await freshStore();
    store.setState({
      transactions: [
        {
          id: "rent",
          type: "expense",
          amount: 4500,
          description: "שכר דירה",
          date: "2026-09-01",
          recurring: { startMonth: "2026-09" },
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
    store.getState().deleteTransactionInSeries("rent", "2026-10", "this");

    expect(store.getState().transactions).toHaveLength(1);
    expect(calls.map((c) => c.method)).toEqual(["PATCH"]);
    expect(calls[0].body?.exceptions).toEqual([
      { month: "2026-10", skip: true },
    ]);
  });

  it("editing from a month onwards splits the series", async () => {
    const store = await freshStore();
    store.setState({
      transactions: [
        {
          id: "rent",
          type: "expense",
          amount: 4500,
          description: "שכר דירה",
          date: "2026-09-01",
          recurring: { startMonth: "2026-09" },
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
    store.getState().editTransactionInSeries("rent", "2027-01", "following", {
      amount: 4800,
    });

    const [oldSeries, newSeries] = store.getState().transactions;
    expect(oldSeries.recurring?.endMonth).toBe("2026-12");
    expect(newSeries.amount).toBe(4800);
    expect(newSeries.recurring?.startMonth).toBe("2027-01");
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"]);
  });
});

describe("undo delete", () => {
  it("puts the task back in place and re-creates it with the same id", async () => {
    const store = await freshStore();
    store.getState().addTask({ title: "a", priority: "normal" });
    store.getState().addTask({ title: "b", priority: "normal" });
    store.getState().addTask({ title: "c", priority: "normal" });
    const b = store.getState().tasks[1];

    store.getState().deleteTask(b.id);
    expect(store.getState().tasks.map((t) => t.title)).toEqual(["a", "c"]);

    const offer = toasts.find((t) => t.label === "המשימה נמחקה");
    expect(offer?.undo).toBeTypeOf("function");
    offer!.undo!();
    expect(store.getState().tasks.map((t) => t.title)).toEqual(["a", "b", "c"]);

    // The re-create waits for the delete to finish before it is sent.
    await new Promise((r) => setTimeout(r, 100));
    const tail = calls.slice(-2).map((c) => [c.method, c.body?.id ?? c.url]);
    expect(tail).toEqual([
      ["DELETE", `/api/tasks/${b.id}`],
      ["POST", b.id],
    ]);
  });

  it("restores a list item at its old index, ticked state included", async () => {
    const store = await freshStore();
    store.getState().addChecklist("קניות", ["שמן", "חלב", "לחם"]);
    const list = store.getState().checklists[0];
    store.getState().toggleChecklistItem(list.id, list.items[1].id);
    store.getState().deleteChecklistItem(list.id, list.items[1].id);

    toasts.at(-1)!.undo!();
    const items = store.getState().checklists[0].items;
    expect(items.map((i) => [i.text, i.done])).toEqual([
      ["שמן", false],
      ["חלב", true],
      ["לחם", false],
    ]);

    await new Promise((r) => setTimeout(r, 100));
    expect(calls.at(-1)?.body).toMatchObject({
      addItem: "חלב",
      addItemIndex: 1,
      addItemDone: true,
    });
  });
});

describe("snooze", () => {
  it("moves the due date to tomorrow", async () => {
    const store = await freshStore();
    store.getState().addTask({
      title: "x",
      priority: "normal",
      dueDate: "2020-01-01",
    });
    const id = store.getState().tasks[0].id;
    store.getState().snoozeTask(id);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    expect(store.getState().tasks[0].dueDate).toBe(expected);
    expect(calls.at(-1)?.body).toEqual({ dueDate: expected });
  });
});
