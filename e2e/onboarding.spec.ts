import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A device that hasn't seen the first-run questions (the default state for
// the other tests has them answered).
test.use({
  viewport: { width: 1280, height: 800 },
  storageState: {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:3100",
        localStorage: [
          {
            name: "lior-device",
            value: JSON.stringify({ autoBrief: false, fired: {} }),
          },
        ],
      },
    ],
  },
});

test.afterEach(async ({ request }) => {
  await request.patch("/api/settings", { data: { prefs: { userName: null } } });
});

test("the first run asks for a name, then the next questions, once", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: /ברוכים הבאים/ });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include("[role=dialog]")
    .analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await dialog.getByLabel("איך לקרוא לך?").fill("נועה");
  await dialog.getByRole("button", { name: "המשך" }).click();

  // Saving the name doesn't close the questions that follow it.
  await expect(
    page.getByRole("dialog", { name: /להתחיל ריק|יש לך גיבוי/ }),
  ).toBeVisible();
  const empty = page.getByRole("button", { name: "להתחיל ריק" });
  if (await empty.count()) await empty.click();
  await page.getByRole("button", { name: "אין, מתחילים" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/, נועה ·/)).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("data that already has a name doesn't ask", async ({ page, request }) => {
  await request.patch("/api/settings", { data: { prefs: { userName: "דני" } } });
  await page.goto("/");
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/, דני ·/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
