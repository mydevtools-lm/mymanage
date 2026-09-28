import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1280, height: 800 } });

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

test("the manifest and its icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "ניהול אישי",
    lang: "he",
    dir: "rtl",
    display: "standalone",
    start_url: "/",
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
});

test("the service worker keeps the app opening without the server", async ({
  page,
  context,
}) => {
  await ready(page, "/");
  const active = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return !!registration.active;
  });
  expect(active).toBe(true);
  // Let the worker take over this page, then cache it by visiting.
  await page.reload();
  await expect(page.getByRole("heading", { name: "היום" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "היום" })).toBeVisible();
  await context.setOffline(false);
});

test("a home-screen shortcut opens a new task", async ({ page }) => {
  await ready(page, "/?new=task");
  await expect(page.getByRole("dialog", { name: "משימה חדשה" })).toBeVisible();
  // Handled once: the address no longer asks for it.
  expect(new URL(page.url()).search).toBe("");
});

test("preferences: the week starts on Monday, amounts in dollars", async ({
  page,
}) => {
  await ready(page, "/settings?tab=preferences");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include("main")
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);

  const pick = async (label: string, option: string) => {
    await page.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option }).click();
  };
  await pick("השבוע מתחיל ביום", "שני");
  await pick("מטבע", "דולר ($)");

  await ready(page, "/calendar");
  await page.getByRole("tab", { name: "תצוגת חודש" }).click();
  const firstHeader = page
    .locator(".grid-cols-7")
    .first()
    .locator("div")
    .first();
  await expect(firstHeader).toHaveText("ב׳");

  await ready(page, "/finance");
  await expect(page.getByText("$").first()).toBeVisible();

  // Back to the defaults, for the screens that run after this.
  await ready(page, "/settings?tab=preferences");
  await pick("השבוע מתחיל ביום", "ראשון");
  await pick("מטבע", "שקל (₪)");
  await ready(page, "/finance");
  await expect(page.getByText("₪").first()).toBeVisible();
});
