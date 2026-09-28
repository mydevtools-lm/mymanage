import { readFileSync } from "node:fs";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1280, height: 800 } });

function today() {
  return new Date().toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
}

function israeli(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function categoryId(request: APIRequestContext, name: string) {
  const all: { id: string; name: string }[] = await (
    await request.get("/api/categories")
  ).json();
  return all.find((c) => c.name === name)!.id;
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

test("a bank statement imports: duplicates skipped, categories learned", async ({
  page,
  request,
}) => {
  const day = today();
  const food = await categoryId(request, "אוכל");
  // Taught earlier: this supermarket is food. And the salary is already in.
  await request.post("/api/transactions", {
    data: {
      id: "fin-past",
      type: "expense",
      amount: 300,
      description: "שופרסל דיל 991",
      date: "2026-01-15",
      categoryId: food,
    },
  });
  await request.post("/api/transactions", {
    data: {
      id: "fin-salary",
      type: "income",
      amount: 12500,
      description: "משכורת",
      date: day,
    },
  });

  const csv = [
    "תנועות בחשבון",
    "תאריך,תאריך ערך,תיאור,אסמכתא,חובה,זכות,יתרה",
    `${israeli(day)},${israeli(day)},שופרסל דיל 123,1,"1,250.40",,"8,000.00"`,
    `${israeli(day)},${israeli(day)},משכורת,2,,"12,500.00","9,250.40"`,
    `${israeli(day)},${israeli(day)},"פז, תחנת דלק",3,180,,"-3,249.60"`,
  ].join("\r\n");

  await ready(page, "/finance");
  await page.getByRole("button", { name: "ייבוא" }).click();
  const dialog = page.getByRole("dialog", { name: "ייבוא מדף חשבון" });
  await dialog.getByLabel("קובץ מהבנק").setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("﻿" + csv, "utf-8"),
  });

  await expect(dialog.getByRole("status")).toHaveText(
    "נמצאו 3 תנועות · 1 כבר קיימות ולא סומנו",
  );
  await expect(
    dialog.getByRole("checkbox", { name: "לייבא את משכורת" }),
  ).not.toBeChecked();
  await expect(dialog.getByLabel("קטגוריה לשופרסל דיל 123")).toHaveValue(food);
  expect(await serious(page, "[role=dialog]")).toEqual([]);
  await page.screenshot({ path: "e2e/screenshots/desktop-light-import.png" });

  await dialog.getByRole("button", { name: "ייבוא 2 תנועות" }).click();
  await expect(dialog).toBeHidden();

  const rows: { description: string; categoryId?: string }[] = await (
    await request.get("/api/transactions")
  ).json();
  expect(rows.filter((r) => r.description === "משכורת")).toHaveLength(1);
  expect(rows.find((r) => r.description === "שופרסל דיל 123")?.categoryId).toBe(
    food,
  );
  expect(rows.some((r) => r.description === "פז, תחנת דלק")).toBe(true);
});

test("a budget warns when an expense goes over it", async ({ page }) => {
  await ready(page, "/finance");
  await page.getByRole("button", { name: "תקציב" }).click();
  const budgets = page.getByRole("dialog", { name: "תקציב חודשי" });
  await budgets.getByLabel("תקציב לבילויים").fill("100");
  await budgets.getByRole("button", { name: "שמירה" }).click();

  await page.getByRole("button", { name: "תנועה חדשה" }).first().click();
  const dialog = page.getByRole("dialog", { name: "תנועה חדשה" });
  await dialog.getByLabel("סכום (₪)").fill("150");
  await dialog.getByRole("radio", { name: "בילויים" }).click();
  await dialog.getByLabel("תיאור (רשות)").fill("קולנוע");
  await dialog.getByRole("button", { name: "הוספה" }).click();

  await expect(page.getByText("חריגה מהתקציב של בילויים")).toBeVisible();
  // Currency text carries direction marks around the number: "‏50 ‏₪".
  await expect(page.getByText(/^חריגה של \S*50/)).toBeVisible();
});

test("the year view adds up the months", async ({ page }) => {
  await ready(page, "/finance");
  await page.getByRole("tab", { name: "שנה" }).click();
  await expect(page.getByText("חודש אחר חודש")).toBeVisible();
  await expect(page.getByRole("cell", { name: "סה״כ" })).toBeVisible();
  expect(await serious(page, "main")).toEqual([]);
  await page.screenshot({ path: "e2e/screenshots/desktop-light-year.png" });
});

test("the month exports as CSV and as a printable report", async ({ page }) => {
  await ready(page, "/finance");
  await page.getByRole("button", { name: "ייצוא" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "CSV של החודש" }).click(),
  ]);
  const text = readFileSync(await download.path(), "utf-8");
  expect(text.startsWith("﻿תאריך,תיאור,קטגוריה")).toBe(true);
  expect(text).toContain("קולנוע");

  await page.getByRole("button", { name: "ייצוא" }).click();
  await page.getByRole("menuitem", { name: "דוח להדפסה / PDF" }).click();
  await expect(page.getByRole("heading", { name: /דוח חודשי/ })).toBeVisible();
  await expect(page.getByText("חריגה מהתקציב:")).toBeVisible();
  expect(await serious(page, "main")).toEqual([]);
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: "e2e/screenshots/desktop-print-report.png",
    fullPage: true,
  });
});
