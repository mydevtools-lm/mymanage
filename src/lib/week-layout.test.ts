import { describe, expect, it } from "vitest";
import { layoutDay, minutesOf, MIN_MINUTES } from "./week-layout";

const at = (key: string, start: string, end?: string) => ({ key, start, end });

const summary = (items: ReturnType<typeof layoutDay>) =>
  Object.fromEntries(
    items.map((p) => [
      p.item.key,
      `${p.top}+${p.height} lane ${p.lane}/${p.lanes}`,
    ]),
  );

describe("minutesOf", () => {
  it("reads HH:mm", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("23:59")).toBe(1439);
  });
});

describe("layoutDay", () => {
  it("gives separate events the full width", () => {
    expect(
      summary(
        layoutDay([at("a", "09:00", "10:00"), at("b", "11:00", "12:00")]),
      ),
    ).toEqual({ a: "540+60 lane 0/1", b: "660+60 lane 0/1" });
  });

  it("puts overlapping events side by side", () => {
    expect(
      summary(
        layoutDay([at("a", "09:00", "11:00"), at("b", "10:00", "10:30")]),
      ),
    ).toEqual({ a: "540+120 lane 0/2", b: "600+30 lane 1/2" });
  });

  it("reuses a lane once it frees up, within the same cluster", () => {
    // a covers the morning; b and c follow each other beside it.
    expect(
      summary(
        layoutDay([
          at("a", "09:00", "12:00"),
          at("b", "09:30", "10:30"),
          at("c", "10:30", "11:30"),
        ]),
      ),
    ).toEqual({
      a: "540+180 lane 0/2",
      b: "570+60 lane 1/2",
      c: "630+60 lane 1/2",
    });
  });

  it("back-to-back events do not count as overlapping", () => {
    expect(
      summary(
        layoutDay([at("a", "09:00", "10:00"), at("b", "10:00", "11:00")]),
      ),
    ).toEqual({ a: "540+60 lane 0/1", b: "600+60 lane 0/1" });
  });

  it("gives items without an end an hour, and tiny ones a readable minimum", () => {
    const [noEnd, tiny] = layoutDay([
      at("noEnd", "08:00"),
      at("tiny", "13:00", "13:05"),
    ]);
    expect(noEnd.height).toBe(60);
    expect(tiny.height).toBe(MIN_MINUTES);
  });

  it("keeps a late event inside the day", () => {
    const [late] = layoutDay([at("late", "23:45", "00:30")]);
    expect(late.top + late.height).toBe(24 * 60);
  });
});
