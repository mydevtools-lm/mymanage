import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getTask } from "@/lib/repo";
import { instanceId } from "@/lib/routines";
import { POST } from "./route";

beforeEach(() => {
  resetDbForTests();
});

const today = () => new Date().toLocaleDateString("sv");

describe("POST /api/routines", () => {
  // Regression: the client sent the routine with lastDate = today, the server
  // stored it, and so decided today's copy had already been made.
  it("makes today's copy even when the client says it already did", async () => {
    const response = await POST(
      new Request("http://test/api/routines", {
        method: "POST",
        body: JSON.stringify({
          id: "r1",
          title: "כדורים",
          repeat: { kind: "daily" },
          startDate: today(),
          lastDate: today(),
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await getTask(instanceId("r1", today()))).not.toBeNull();
  });
});
