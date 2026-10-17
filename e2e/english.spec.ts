import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The English interface (sprint ד7): left to right, every screen readable
 * and accessible, "add in a sentence" in English, and switching to Hebrew
 * and back from the preferences. The other tests run in Hebrew.
 */

const device = (prefs: object) => ({
  cookies: [],
  origins: [
    {
      origin: "http://localhost:3100",
      localStorage: [
        {
          name: "lior-device",
          value: JSON.stringify({ autoBrief: false, fired: {}, ...prefs }),
        },
      ],
    },
  ],
});

test.use({
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
  extraHTTPHeaders: { "x-locale": "en" },
  storageState: device({ onboarded: true, language: "en" }),
});

const SCREENS = [
  { path: "/", heading: "Today" },
  { path: "/tasks", heading: "Tasks" },
  { path: "/calendar", heading: "Calendar" },
  { path: "/finance", heading: "Money" },
  { path: "/notes", heading: "Notes & lists" },
  { path: "/settings", heading: "Settings" },
];

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

/** Every text the data holds — titles, category and calendar names — which
 *  stays in the language it was written in (the e2e database is Hebrew). */
async function dataTexts(request: APIRequestContext) {
  const urls = [
    "/api/categories",
    "/api/tasks",
    "/api/events",
    `/api/calendar/google?from=${dayKey(-45)}&to=${dayKey(45)}`,
  ];
  const texts = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) texts.add(value.trim());
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object")
      Object.values(value).forEach(collect);
  };
  for (const url of urls) collect(await (await request.get(url)).json());
  return [...texts].sort((a, b) => b.length - a.length);
}

for (const screen of SCREENS) {
  test(`${screen.path} is in English, left to right, and accessible`, async ({
    page,
    request,
  }) => {
    await ready(page, screen.path);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "en");
    await expect(html).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: screen.heading }),
    ).toBeVisible();

    // No Hebrew letters in the screen's own text — the data may be in any
    // language, and the language picker names Hebrew in Hebrew.
    const text = await page.locator("main").evaluate((main) => {
      const clone = main.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[lang=he]").forEach((el) => el.remove());
      return clone.innerText;
    });
    let own = text;
    for (const data of await dataTexts(request))
      own = own.split(data).join(" ");
    expect(own).not.toMatch(/[א-ת]/);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("an English sentence becomes an event, after a preview", async ({
  page,
  request,
}) => {
  await ready(page, "/");
  await page.keyboard.press("Control+KeyK");
  const input = page.getByRole("combobox", { name: "Search and actions" });
  await expect(input).toBeFocused();
  await input.fill("tomorrow at 10am meeting with the accountant");
  await page.getByRole("option", { name: /^Add:/ }).click();

  const dialog = page.getByRole("dialog", { name: "Add in a sentence" });
  await expect(dialog.getByRole("status")).toContainText("Understood 1 item");
  await expect(dialog.getByLabel("Title")).toHaveValue(
    "Meeting with the accountant",
  );
  await expect(dialog.getByLabel("Time")).toHaveValue("10:00");
  await dialog.getByRole("button", { name: "Add (1)" }).click();

  await expect
    .poll(async () =>
      (
        (await (await request.get("/api/events")).json()) as { title: string }[]
      ).find((e) => e.title === "Meeting with the accountant"),
    )
    .toMatchObject({ date: dayKey(1), startTime: "10:00" });
});

test("the preferences switch to Hebrew and back", async ({ page }) => {
  await ready(page, "/settings");
  await page.getByRole("tab", { name: "Preferences" }).click();
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "עברית" }).click();

  const html = page.locator("html");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("lang", "he");
  await expect(
    page.getByRole("navigation", { name: "ניווט ראשי" }),
  ).toBeVisible();

  // The choice is kept on this device.
  await page.reload();
  await expect(html).toHaveAttribute("dir", "rtl");

  await page.getByRole("tab", { name: "העדפות" }).click();
  await page.getByRole("combobox", { name: "שפה" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});

test.describe("first run", () => {
  test.use({ storageState: device({}) });

  test.afterEach(async ({ request }) => {
    await request.patch("/api/settings", {
      data: { prefs: { userName: null } },
    });
  });

  test("asks for the language first, Windows' one ready", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Choose a language" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("button", { name: "English" })).toBeFocused();

    await dialog.getByRole("button", { name: "עברית" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The questions continue, now in Hebrew, from the name.
    await expect(
      page.getByRole("dialog", { name: /ברוכים הבאים/ }),
    ).toBeVisible();
  });
});
