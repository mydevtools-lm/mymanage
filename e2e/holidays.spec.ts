import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Holidays and memorial days (sprint ד10): they show on Today and in the
 * calendar, and each group can be hidden in Settings › Preferences. The clock
 * is set to Rosh Hashana 5787 (12.9.2026) so the day is the same on every run.
 */

test.use({ viewport: { width: 1280, height: 800 } });

const ROSH_HASHANA = "ראש השנה 5787";
const ROSH_HASHANA_DAY = new Date("2026-09-12T10:00:00+03:00");

async function ready(page: Page, path: string) {
  await page.clock.setFixedTime(ROSH_HASHANA_DAY);
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

test("a holiday shows on Today and in the month, with its legend and day panel", async ({
  page,
}) => {
  await ready(page, "/");
  await expect(page.getByText(ROSH_HASHANA).first()).toBeVisible();

  await ready(page, "/calendar");
  await expect(page.getByText(ROSH_HASHANA).first()).toBeVisible();
  // The legend names the group; the day panel says what the day is.
  await expect(page.getByText("חגי ישראל").first()).toBeVisible();
  await page.getByText(ROSH_HASHANA).first().click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "חגים ותאריכים מיוחדים" }),
  ).toBeVisible();
  await expect(panel.getByText(ROSH_HASHANA)).toBeVisible();
  // It isn't Google's, and nothing in it can be edited or deleted.
  await expect(panel.getByText("גוגל יומן")).toHaveCount(0);
});

test("a group can be hidden in the preferences, and comes back", async ({
  page,
}) => {
  await ready(page, "/settings?tab=preferences");
  const group = page.getByRole("region", { name: "חגי ישראל" });
  await expect(group).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);

  const shown = group.getByRole("switch");
  await expect(shown).toBeChecked();
  await shown.click();
  await expect(shown).not.toBeChecked();

  await ready(page, "/");
  await expect(page.getByText(ROSH_HASHANA)).toHaveCount(0);

  await ready(page, "/settings?tab=preferences");
  await page
    .getByRole("region", { name: "חגי ישראל" })
    .getByRole("switch")
    .click();
  await ready(page, "/");
  await expect(page.getByText(ROSH_HASHANA).first()).toBeVisible();
});
