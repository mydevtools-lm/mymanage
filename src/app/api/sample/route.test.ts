import { describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/sample", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

describe("/api/sample", () => {
  // Regression: the date pattern lost its backslashes (/^d{4}-…/) on the way
  // in, as it once did in /api/calendar/google, and every real date failed.
  it("adds the sample set for a real date, and removes it", async () => {
    const added = await post({ today: "2026-10-13" });
    expect(added.status).toBe(200);
    expect((await added.json()).notes).toHaveLength(1);

    const removed = await DELETE(
      new Request("http://test/api/sample", { method: "DELETE" }),
    );
    expect((await removed.json()).notes).toHaveLength(0);
  });

  it("refuses a malformed date", async () => {
    expect((await post({ today: "13-10-2026" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });
});
