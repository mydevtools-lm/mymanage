import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toJsonBody } from "./json-body";

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

let calls: Call[];

beforeEach(() => {
  calls = [];
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
    store
      .getState()
      .editTransactionInSeries("rent", "2027-01", "following", {
        amount: 4800,
      });

    const [oldSeries, newSeries] = store.getState().transactions;
    expect(oldSeries.recurring?.endMonth).toBe("2026-12");
    expect(newSeries.amount).toBe(4800);
    expect(newSeries.recurring?.startMonth).toBe("2027-01");
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"]);
  });
});
