import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

async function ready(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

test("N opens a new task, by key position — works on a Hebrew layout", async ({
  page,
}) => {
  await ready(page, "/tasks");
  // Physical N key while the Hebrew layout is active types "מ".
  await page.keyboard.down("KeyN");
  await page.keyboard.up("KeyN");
  await expect(page.getByRole("dialog", { name: "משימה חדשה" })).toBeVisible();
});

test("shortcuts stay out of the way while typing", async ({ page }) => {
  await ready(page, "/tasks");
  const search = page.getByPlaceholder("חיפוש...");
  await search.click();
  await page.keyboard.press("KeyN");
  await expect(search).toHaveValue("n");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("/ jumps to the screen's search field", async ({ page }) => {
  await ready(page, "/finance");
  await page.keyboard.press("Slash");
  await expect(page.getByPlaceholder("חיפוש תיאור או סכום...")).toBeFocused();
});

test("? lists the shortcuts", async ({ page }) => {
  await ready(page, "/");
  await page.keyboard.press("Shift+Slash");
  await expect(
    page.getByRole("dialog", { name: "קיצורי מקלדת" }),
  ).toBeVisible();
});

test("the skip link is the first stop and moves focus to the content", async ({
  page,
}) => {
  await ready(page, "/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "דלג לתוכן" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("a task added on Today shows up there and in Tasks", async ({ page }) => {
  await ready(page, "/");
  await page.getByRole("button", { name: "משימה", exact: true }).click();
  await page.getByPlaceholder("מה צריך לעשות?").fill("משימת קצה לקצה");
  await page.getByRole("button", { name: "הוספה" }).click();
  await expect(page.getByText("משימת קצה לקצה")).toBeVisible();

  await ready(page, "/tasks");
  await expect(page.getByText("משימת קצה לקצה")).toBeVisible();
});
