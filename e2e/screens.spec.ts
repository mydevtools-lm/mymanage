import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Every main screen, at phone and desktop width, in light and dark:
 * a screenshot for comparing sprints by eye, and an accessibility scan
 * that fails on serious or critical problems (contrast, labels, roles).
 */

const SCREENS = [
  { name: "today", path: "/" },
  { name: "tasks", path: "/tasks" },
  { name: "calendar", path: "/calendar" },
  { name: "finance", path: "/finance" },
  { name: "notes", path: "/notes" },
  { name: "settings", path: "/settings" },
];

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

const THEMES = ["light", "dark"] as const;

function today() {
  return new Date().toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
}

// Enough data that every screen shows real content, not just empty states.
// Playwright reruns beforeAll in a fresh worker after a failure; seed once.
test.beforeAll(async ({ request }) => {
  const tasks: { id: string }[] = await (
    await request.get("/api/tasks")
  ).json();
  if (tasks.some((t) => t.id === "e2e-t1")) return;
  const day = today();
  const month = day.slice(0, 7);
  const post = (url: string, data: object) => request.post(url, { data });
  await post("/api/tasks", {
    id: "e2e-t1",
    title: "להתקשר לבנק",
    dueDate: day,
    dueTime: "10:30",
    priority: "high",
  });
  await post("/api/tasks", {
    id: "e2e-t2",
    title: "לסדר את המחסן",
    priority: "normal",
  });
  await post("/api/events", {
    id: "e2e-e1",
    title: "פגישה",
    date: day,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    color: "lavender",
  });
  await post("/api/transactions", {
    id: "e2e-x1",
    type: "income",
    amount: 12000,
    description: "משכורת",
    date: `${month}-10`,
    recurring: { startMonth: month },
  });
  await post("/api/transactions", {
    id: "e2e-x2",
    type: "expense",
    amount: 480,
    description: "סופר",
    date: day,
  });
  await post("/api/checklists", {
    id: "e2e-l1",
    title: "קניות",
    items: ["חלב", "לחם"],
  });
  await post("/api/notes", {
    id: "e2e-n1",
    title: "רעיון",
    body: "לכתוב אפיון",
  });
});

async function open(page: Page, path: string, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    localStorage.setItem("theme", t);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  // Content renders once the data has loaded; the skeleton goes away.
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name} · ${theme}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const screen of SCREENS) {
        test(screen.name, async ({ page }) => {
          await open(page, screen.path, theme);

          await page.screenshot({
            path: `e2e/screenshots/${viewport.name}-${theme}-${screen.name}.png`,
            fullPage: true,
          });

          // No sideways scrolling on a phone.
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

          const { violations } = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            // The Next.js dev overlay is not part of the app.
            .exclude("nextjs-portal")
            .analyze();
          const serious = violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          );
          expect(
            serious.map((v) => ({
              rule: v.id,
              impact: v.impact,
              help: v.help,
              targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
              sample: v.nodes[0]?.failureSummary?.slice(0, 300),
            })),
          ).toEqual([]);
        });
      }
    });
  }
}
