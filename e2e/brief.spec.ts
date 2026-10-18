import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1280, height: 800 } });

function israelNow(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const date = d.toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function serious(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include(include)
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target) }));
}

test.beforeAll(async ({ request }) => {
  const { date } = israelNow();
  const tomorrow = israelNow(24 * 60).date;
  await request.post("/api/tasks", {
    data: {
      id: "b-task",
      title: "לשלוח דוח",
      dueDate: date,
      priority: "normal",
    },
  });
  // A monthly bill that falls tomorrow.
  await request.post("/api/transactions", {
    data: {
      id: "b-bill",
      type: "expense",
      amount: 320,
      description: "חשבון חשמל",
      date: tomorrow,
      recurring: { startMonth: tomorrow.slice(0, 7) },
    },
  });
});

test.describe("on the first visit of the day", () => {
  // A device that hasn't seen the brief yet — but has answered the first-run
  // questions, which otherwise come first.
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3100",
          localStorage: [
            {
              name: "lior-device",
              value: JSON.stringify({ onboarded: true, language: "he", fired: {} }),
            },
          ],
        },
      ],
    },
  });

  test("the morning brief opens by itself, once", async ({ page }) => {
    test.skip(new Date().getHours() < 5, "The brief waits for the morning.");
    await ready(page, "/");
    const brief = page.getByRole("dialog");
    await expect(brief.getByRole("tab", { name: "תדריך בוקר" })).toBeVisible();
    await expect(brief.getByText("לשלוח דוח")).toBeVisible();
    // Google events are part of the day too.
    await expect(brief.getByText("פגישה מגוגל")).toBeVisible();
    await expect(brief.getByText("חשבון חשמל")).toBeVisible();
    expect(await serious(page, "[role=dialog]")).toEqual([]);
    await page.screenshot({ path: "e2e/screenshots/desktop-light-brief.png" });

    await brief.getByRole("button", { name: "סגירה" }).first().click();
    await ready(page, "/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("the brief and the week summary open from Today", async ({ page }) => {
  await ready(page, "/");
  await page.getByRole("button", { name: "תדריך" }).click();
  const brief = page.getByRole("dialog");
  await expect(brief.getByText("החודש עד עכשיו")).toBeVisible();
  await brief.getByRole("tab", { name: "סיכום שבוע" }).click();
  await expect(brief.getByText("משימות שהושלמו")).toBeVisible();
  expect(await serious(page, "[role=dialog]")).toEqual([]);
});

test("a reminder shows when its time comes", async ({ page, request }) => {
  // Five minutes ahead, reminded ten minutes before: due now.
  const soon = israelNow(5);
  test.skip(soon.date !== israelNow().date, "Too close to midnight.");
  await request.post("/api/tasks", {
    data: {
      id: "b-remind",
      title: "להוציא את הכביסה",
      dueDate: soon.date,
      dueTime: soon.time,
      reminder: 10,
      priority: "normal",
    },
  });
  await ready(page, "/");
  await expect(
    page.getByRole("listitem").filter({ hasText: "בעוד 10 דקות" }),
  ).toContainText("להוציא את הכביסה");

  // Once only: after a reload it doesn't come back.
  await ready(page, "/");
  await page.waitForTimeout(1500);
  await expect(
    page.getByRole("listitem").filter({ hasText: "בעוד 10 דקות" }),
  ).toHaveCount(0);
});

test("the notifications settings are accessible", async ({ page }) => {
  await ready(page, "/settings?tab=notifications");
  await expect(page.getByText("תדריך בוקר").first()).toBeVisible();
  expect(await serious(page, "main")).toEqual([]);
});
