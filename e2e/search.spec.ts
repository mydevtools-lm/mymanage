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

async function palette(page: Page, query: string) {
  await page.keyboard.press("Control+KeyK");
  const input = page.getByRole("combobox", { name: "חיפוש ופעולות" });
  await expect(input).toBeFocused();
  await input.fill(query);
  return input;
}

test.beforeAll(async ({ request }) => {
  await request.post("/api/tasks", {
    data: { id: "s-task", title: "להחליף סיסמה בבנק", priority: "high" },
  });
  await request.post("/api/events", {
    data: {
      id: "s-event",
      title: "פגישה עם יועץ משכנתאות",
      date: dayKey(2),
      allDay: true,
      color: "sky",
    },
  });
  await request.post("/api/checklists", {
    data: {
      id: "s-list",
      title: "קניות לשבוע",
      items: ["שמן בישול", "אקונומיקה"],
    },
  });
});

test("Ctrl+K finds a list by an item in it and opens it there", async ({
  page,
}) => {
  await ready(page, "/");
  await palette(page, "אקונומיקה");
  const option = page.getByRole("option", { name: /קניות לשבוע/ });
  await expect(option).toContainText("ברשימה: אקונומיקה");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include("[role=dialog]")
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({ path: "e2e/screenshots/desktop-light-palette.png" });

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/notes\?tab=lists&focus=s-list/);
  await expect(page.locator("#item-s-list")).toBeVisible();
});

test("Ctrl+K opens a task in its dialog", async ({ page }) => {
  await ready(page, "/calendar");
  await palette(page, "סיסמה");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "עריכת משימה" });
  await expect(dialog.getByLabel("כותרת")).toHaveValue("להחליף סיסמה בבנק");
});

test("a sentence becomes items, after a preview", async ({ page, request }) => {
  await ready(page, "/");
  await palette(page, "מחר בשעה 10 פגישה עם רואה חשבון");
  await page.getByRole("option", { name: /^להוסיף:/ }).click();

  const dialog = page.getByRole("dialog", { name: "הוספה במשפט" });
  await expect(dialog.getByRole("status")).toContainText("הובנו 1 פריטים");
  await expect(dialog.getByLabel("כותרת")).toHaveValue("פגישה עם רואה חשבון");
  await expect(dialog.getByLabel("שעה")).toHaveValue("10:00");
  await dialog.getByRole("button", { name: "הוספה (1)" }).click();

  await expect
    .poll(async () =>
      (
        (await (await request.get("/api/events")).json()) as { title: string }[]
      ).find((e) => e.title === "פגישה עם רואה חשבון"),
    )
    .toMatchObject({ date: dayKey(1), startTime: "10:00" });
});

test("a task and an event can be linked, and each opens the other", async ({
  page,
}) => {
  await ready(page, "/");
  await palette(page, "סיסמה");
  await page.keyboard.press("Enter");

  const taskDialog = page.getByRole("dialog", { name: "עריכת משימה" });
  await taskDialog.getByRole("button", { name: "קישור לפריט" }).click();
  await taskDialog.getByLabel("חיפוש פריט לקישור").fill("משכנתאות");
  await taskDialog
    .getByRole("button", { name: /פגישה עם יועץ משכנתאות/ })
    .click();
  await expect(
    taskDialog.getByRole("button", {
      name: "פגישה עם יועץ משכנתאות",
      exact: true,
    }),
  ).toBeVisible();

  // From the link, straight into the event.
  await taskDialog
    .getByRole("button", { name: "פגישה עם יועץ משכנתאות", exact: true })
    .click();
  const eventDialog = page.getByRole("dialog", { name: "עריכת אירוע" });
  await expect(eventDialog.getByLabel("כותרת")).toHaveValue(
    "פגישה עם יועץ משכנתאות",
  );
  await expect(
    eventDialog.getByRole("button", { name: "להחליף סיסמה בבנק", exact: true }),
  ).toBeVisible();
});
