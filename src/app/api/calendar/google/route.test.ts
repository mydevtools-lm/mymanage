import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = (query: string) =>
  GET(new Request(`http://test/api/calendar/google?${query}`));

describe("GET /api/calendar/google", () => {
  // Regression: the date pattern lost its backslashes (/^d{4}-…/), so every
  // real range was refused and no Google event ever showed.
  it("accepts a real date range", async () => {
    const response = await call("from=2026-09-28&to=2026-10-04");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ configured: false });
  });

  it("refuses a malformed or reversed range", async () => {
    expect((await call("from=28-09-2026&to=2026-10-04")).status).toBe(400);
    expect((await call("from=2026-10-04&to=2026-09-28")).status).toBe(400);
  });
});
