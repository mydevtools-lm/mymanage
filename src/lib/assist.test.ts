import { afterEach, describe, expect, it, vi } from "vitest";
import { readProposals, sanitizeProposals } from "./assist";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sanitizeProposals", () => {
  it("keeps well-formed items and drops the rest", () => {
    expect(
      sanitizeProposals({
        items: [
          { kind: "event", title: " חממה ", date: "2026-09-28", time: "9:00" },
          { kind: "transaction", title: "סופר", amount: 250 },
          { kind: "transaction", title: "בלי סכום" },
          { kind: "meeting", title: "סוג לא מוכר" },
          { kind: "task", title: "" },
        ],
      }),
    ).toEqual([
      { kind: "event", title: "חממה", date: "2026-09-28" },
      { kind: "transaction", title: "סופר", amount: 250, type: "expense" },
    ]);
    expect(sanitizeProposals(null)).toEqual([]);
  });
});

describe("readProposals", () => {
  it("uses the local rules when no key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await readProposals("מחר חממה", "2026-09-27");
    expect(result.source).toBe("local");
    expect(result.proposals).toEqual([
      { kind: "event", title: "חממה", date: "2026-09-28" },
    ]);
  });

  it("asks Claude when a key is set, and falls back if it fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      Response.json({
        content: [
          {
            type: "tool_use",
            input: { items: [{ kind: "task", title: "להתקשר לרופא" }] },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await readProposals("להתקשר לרופא", "2026-09-27");
    expect(result).toEqual({
      source: "claude",
      proposals: [{ kind: "task", title: "להתקשר לרופא" }],
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "test-key",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    expect((await readProposals("מחר חממה", "2026-09-27")).source).toBe(
      "local",
    );
  });
});
