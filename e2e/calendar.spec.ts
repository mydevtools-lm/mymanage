import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1280, height: 800 } });

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function view(page: Page, name: "חודש" | "שבוע" | "רשימה") {
  await page.getByRole("tab", { name: `תצוגת ${name}` }).click();
}

test("a weekly event repeats, and one day or the rest can be deleted", async ({
  page,
}) => {
  await ready(page, "/calendar");
  await page.getByRole("button", { name: "אירוע חדש" }).first().click();
  const dialog = page.getByRole("dialog", { name: "אירוע חדש" });
  await dialog.getByLabel("כותרת").fill("חוג ציור");
  await dialog.getByLabel("שעת התחלה").fill("17:00");
  await dialog.getByRole("combobox", { name: "חזרה" }).click();
  await page.getByRole("option", { name: "בימים קבועים בשבוע" }).click();
  await dialog.getByRole("button", { name: "הוספה" }).click();
  await expect(dialog).toBeHidden();

  await view(page, "רשימה");
  const occurrences = page.getByRole("button", { name: /חוג ציור/ });
  // 30 days of list: four or five weeks.
  await expect.poll(() => occurrences.count()).toBeGreaterThanOrEqual(4);
  const total = await occurrences.count();

  // Just the second one.
  await occurrences.nth(1).click();
  await page.getByRole("button", { name: "מחיקה" }).click();
  await page.getByRole("button", { name: /רק המופע הזה/ }).click();
  await expect(occurrences).toHaveCount(total - 1);

  // From the (new) second one on.
  await occurrences.nth(1).click();
  await page.getByRole("button", { name: "מחיקה" }).click();
  await page.getByRole("button", { name: /מכאן והלאה/ }).click();
  await expect(occurrences).toHaveCount(1);

  await ready(page, "/calendar");
  await view(page, "רשימה");
  await expect(occurrences).toHaveCount(1);
});

test("dragging in the week grid changes the time, and the day", async ({
  page,
  request,
}) => {
  await request.post("/api/events", {
    data: {
      id: "drag-1",
      title: "לגרור",
      date: dayKey(),
      startTime: "10:00",
      endTime: "11:00",
      allDay: false,
      color: "amber",
    },
  });
  await ready(page, "/calendar");
  await view(page, "שבוע");

  const block = page.getByRole("button", { name: /לגרור/ });
  const box = (await block.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Two hours down: 48px an hour.
  await page.mouse.move(x, y + 50, { steps: 4 });
  await page.mouse.move(x, y + 96, { steps: 4 });
  await page.mouse.up();

  // Dropping must not open the editor.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await request.get("/api/events/drag-1")).json())
    .toMatchObject({ date: dayKey(), startTime: "12:00", endTime: "13:00" });

  // One column to the left is the next day (right to left).
  const moved = (await block.boundingBox())!;
  // An empty hour slot spans its day column exactly.
  const slot = (await page
    .getByRole("button", { name: "אירוע חדש ב־03:00" })
    .first()
    .boundingBox())!;
  const column = slot.width;
  await page.mouse.move(moved.x + moved.width / 2, moved.y + 8);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width / 2 - column, moved.y + 8, {
    steps: 6,
  });
  await page.mouse.up();
  const next = dayKey(1);
  await expect
    .poll(async () => (await request.get("/api/events/drag-1")).json())
    .toMatchObject({ startTime: "12:00", date: next });
});

test("dragging a task to another day in the month grid", async ({
  page,
  request,
}) => {
  // A quiet day inside this month, so the chip isn't folded into "+N".
  const early = new Date().getDate() <= 20;
  const from = dayKey(early ? 3 : -3);
  const target = dayKey(early ? 4 : -4);
  await request.post("/api/tasks", {
    data: {
      id: "month-drag",
      title: "משימה לגרירה",
      dueDate: from,
      priority: "normal",
    },
  });
  await ready(page, "/calendar");
  await view(page, "חודש");

  const label = (key: string) => {
    const [, m, d] = key.split("-").map(Number);
    return `${d}.${m} —`;
  };
  await page
    .getByTitle("משימה לגרירה")
    .dragTo(page.getByRole("button", { name: label(target) }));
  await expect
    .poll(async () => (await request.get("/api/tasks/month-drag")).json())
    .toMatchObject({ dueDate: target });
});

test("two Google calendars: both show, and one can be hidden", async ({
  page,
}) => {
  await ready(page, "/");
  await expect(page.getByText("פגישה מגוגל")).toBeVisible();
  await expect(page.getByText("סטנדאפ צוות")).toBeVisible();

  await ready(page, "/settings?tab=connections");
  const work = page.getByRole("region", { name: "עבודה" });
  await expect(page.getByRole("region", { name: "גוגל יומן" })).toBeVisible();
  await expect(work).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include("main")
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);

  await work.getByRole("switch", { name: "הצגה" }).click();
  await ready(page, "/");
  await expect(page.getByText("פגישה מגוגל")).toBeVisible();
  await expect(page.getByText("סטנדאפ צוות")).toHaveCount(0);

  // Back as it was, for the screens that run after this.
  await ready(page, "/settings?tab=connections");
  await page
    .getByRole("region", { name: "עבודה" })
    .getByRole("switch", { name: "הצגה" })
    .click();
  await ready(page, "/");
  await expect(page.getByText("סטנדאפ צוות")).toBeVisible();
});
