import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1280, height: 800 } });

function today() {
  return new Date().toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

test("a routine shows up today by itself, once, and ticking files only today's copy", async ({
  page,
}) => {
  await ready(page, "/tasks");
  await page.getByRole("tab", { name: /קבועות/ }).click();
  await page.getByRole("button", { name: "משימה קבועה" }).first().click();

  const dialog = page.getByRole("dialog", { name: "משימה חדשה" });
  await dialog.getByPlaceholder("מה צריך לעשות?").fill("כדורי בוקר");
  await dialog.getByRole("button", { name: "הוספה" }).click();

  await expect(page.getByText("כדורי בוקר")).toBeVisible();
  await expect(
    page.getByText("כל יום", { exact: false }).first(),
  ).toBeVisible();

  await ready(page, "/");
  await expect(page.getByText("כדורי בוקר")).toHaveCount(1);
  // Loading again must not make a second copy.
  await ready(page, "/");
  await expect(page.getByText("כדורי בוקר")).toHaveCount(1);

  await page.getByRole("checkbox", { name: "סימון כדורי בוקר" }).click();
  await expect(page.getByText("כדורי בוקר")).toHaveCount(0);
  await ready(page, "/");
  await expect(page.getByText("כדורי בוקר")).toHaveCount(0);

  // The routine itself stays.
  await ready(page, "/tasks");
  await page.getByRole("tab", { name: /קבועות/ }).click();
  await expect(page.getByText("כדורי בוקר")).toBeVisible();
});

test("subtasks are added in the dialog and ticked from the row", async ({
  page,
}) => {
  await ready(page, "/tasks");
  await page.getByRole("button", { name: "משימה חדשה" }).first().click();
  const dialog = page.getByRole("dialog", { name: "משימה חדשה" });
  await dialog.getByPlaceholder("מה צריך לעשות?").fill("מעבר דירה");
  const step = dialog.getByPlaceholder("הוספת תת־משימה");
  await step.fill("קרטונים");
  await step.press("Enter");
  await step.fill("הובלה");
  await step.press("Enter");
  // Enter added steps; the dialog is still open.
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "הוספה" }).click();

  const progress = page.getByRole("button", { name: "תת־משימות: 0 מתוך 2" });
  await progress.first().click();
  await page.getByRole("checkbox", { name: "קרטונים" }).click();
  await expect(
    page.getByRole("button", { name: "תת־משימות: 1 מתוך 2" }).first(),
  ).toBeVisible();

  await ready(page, "/tasks");
  await expect(
    page.getByRole("button", { name: "תת־משימות: 1 מתוך 2" }).first(),
  ).toBeVisible();
});

test("today's tasks keep a hand-picked order", async ({ page, request }) => {
  const day = today();
  for (const [id, title] of [
    ["order-1", "ראשונה"],
    ["order-2", "שנייה"],
  ]) {
    await request.post("/api/tasks", {
      data: { id, title, dueDate: day, priority: "normal" },
    });
  }

  await ready(page, "/");
  // The title of each row that has a drag handle, top to bottom.
  const titles = () =>
    page
      .locator("[data-drag-handle]")
      .evaluateAll((handles) =>
        handles.map(
          (h) =>
            h.parentElement?.querySelector(".truncate.font-medium")
              ?.textContent ?? "",
        ),
      );

  const before = await titles();
  const last = before.length - 1;
  await page.locator("[data-drag-handle]").nth(last).focus();
  await page.keyboard.press("ArrowUp");
  const expected = [...before];
  [expected[last - 1], expected[last]] = [expected[last], expected[last - 1]];
  await expect.poll(titles).toEqual(expected);

  await ready(page, "/");
  await expect.poll(titles).toEqual(expected);
});

async function seriousViolations(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include(include)
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target) }));
}

for (const theme of ["light", "dark"] as const) {
  test(`routine dialog and list are accessible · ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await ready(page, "/tasks");
    const tab = page.getByRole("tab", { name: /קבועות/ });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await page.screenshot({
      path: `e2e/screenshots/desktop-${theme}-routines.png`,
    });
    expect(await seriousViolations(page, "main")).toEqual([]);

    await page.getByRole("button", { name: "משימה קבועה" }).first().click();
    const dialog = page.getByRole("dialog", { name: "משימה חדשה" });
    await dialog.getByRole("combobox", { name: "חזרה" }).click();
    await page.getByRole("option", { name: "בימים קבועים בשבוע" }).click();
    await expect(
      dialog.getByRole("group", { name: "ימים בשבוע" }),
    ).toBeVisible();
    const thursday = dialog.getByRole("button", { name: "ה׳", exact: true });
    await thursday.click();
    await expect(thursday).toHaveAttribute("aria-pressed", "true");
    // A routine starts today unless told otherwise.
    await expect(dialog.getByLabel("החל מתאריך")).not.toHaveValue("");
    await page.screenshot({
      path: `e2e/screenshots/desktop-${theme}-routine-dialog.png`,
    });
    expect(await seriousViolations(page, "[role=dialog]")).toEqual([]);
  });
}

test("a task is dragged to another day by its handle, undone, and moved by click", async ({
  page,
  request,
}) => {
  const title = "לגרור למחר";
  await request.post("/api/tasks", {
    data: { title, dueDate: today(), priority: "normal" },
  });
  await ready(page, "/tasks");
  const handle = page.getByRole("button", {
    name: `העברת ״${title}״ ליום אחר`,
  });

  // Dragging shows the days; dropping on "tomorrow" moves it there.
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 5 });
  const tomorrow = page.locator('[data-drop-day="tomorrow"]');
  await expect(tomorrow).toBeVisible();
  await tomorrow.hover();
  await page.mouse.up();
  await expect(
    page.getByRole("region", { name: "מחר" }).getByText(title),
  ).toBeVisible();

  // The toast takes it back.
  await page.getByRole("button", { name: "ביטול" }).click();
  await expect(
    page.getByRole("region", { name: "היום" }).getByText(title),
  ).toBeVisible();

  // A click on the handle picks a date instead — here, none.
  await handle.click();
  const dialog = page.getByRole("dialog", { name: `העברת ״${title}״` });
  await dialog.getByRole("button", { name: "בלי תאריך" }).click();
  await expect(
    page.getByRole("region", { name: "בלי תאריך" }).getByText(title),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const tasks = (await (await request.get("/api/tasks")).json()) as {
        title: string;
        dueDate?: string | null;
      }[];
      return tasks.find((t) => t.title === title)?.dueDate ?? null;
    })
    .toBeNull();
});
