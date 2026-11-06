import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Open debts: a tab of their own under Money, kept apart from income and
 * expenses. Every test starts from an empty database (global setup per run),
 * so each makes a debt with a name of its own and looks only for that.
 */

test.use({ viewport: { width: 1280, height: 800 } });

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
}

async function debtsTab(page: Page) {
  await page.goto("/finance?view=debts");
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function addDebt(
  page: Page,
  person: string,
  amount: string,
  dueDate?: string,
) {
  await page.getByRole("button", { name: "חוב חדש" }).first().click();
  const dialog = page.getByRole("dialog", { name: "חוב חדש" });
  await dialog.getByLabel("מול מי").fill(person);
  await dialog.getByLabel("סכום").fill(amount);
  if (dueDate) await dialog.getByLabel("מועד (לא חובה)").fill(dueDate);
  await dialog.getByRole("button", { name: "הוספה" }).click();
  await expect(dialog).toHaveCount(0);
}

const row = (page: Page, person: string) =>
  page.locator(".group").filter({ hasText: person });

/** The month's income, expenses and balance, as the API has them. */
async function transactionCount(page: Page) {
  const rows = await (await page.request.get("/api/transactions")).json();
  return rows.length as number;
}

test("a debt is paid in parts, closes when paid, and stays out of the balance", async ({
  page,
}) => {
  await debtsTab(page);
  const before = await transactionCount(page);
  await addDebt(page, "דנה בדיקה", "1000");
  await expect(row(page, "דנה בדיקה")).toContainText("1,000");

  await row(page, "דנה בדיקה").hover();
  await row(page, "דנה בדיקה").getByRole("button", { name: "רישום תשלום" }).click();
  const pay = page.getByRole("dialog", { name: "תשלום: דנה בדיקה" });
  await pay.getByLabel("סכום").fill("1500");
  await pay.getByRole("button", { name: "רישום תשלום" }).click();
  await expect(page.getByText("התשלום גדול ממה שנותר לשלם")).toBeVisible();
  await pay.getByLabel("סכום").fill("400");
  await pay.getByRole("button", { name: "רישום תשלום" }).click();
  await expect(pay).toHaveCount(0);
  await expect(row(page, "דנה בדיקה")).toContainText("600");

  expect(await transactionCount(page)).toBe(before);

  await row(page, "דנה בדיקה").hover();
  await row(page, "דנה בדיקה").getByRole("button", { name: "רישום תשלום" }).click();
  await page
    .getByRole("dialog", { name: "תשלום: דנה בדיקה" })
    .getByRole("button", { name: "רישום תשלום" })
    .click();
  await expect(row(page, "דנה בדיקה")).toHaveCount(0);

  await page.getByRole("button", { name: /סגורים/ }).click();
  await expect(row(page, "דנה בדיקה")).toContainText("שולם במלואו");
});

test("it survives a reload, and a deleted one comes back with undo", async ({
  page,
}) => {
  await debtsTab(page);
  await addDebt(page, "יוסי נשמר", "250");
  await page.reload();
  await expect(row(page, "יוסי נשמר")).toBeVisible();

  await row(page, "יוסי נשמר").hover();
  await row(page, "יוסי נשמר").getByRole("button", { name: "מחיקה" }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "מחיקה" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(row(page, "יוסי נשמר")).toHaveCount(0);
  await page.getByRole("button", { name: "בטל" }).click();
  await expect(row(page, "יוסי נשמר")).toBeVisible();
});

test("one due this week shows on Today, and opens the debts", async ({
  page,
}) => {
  await debtsTab(page);
  await addDebt(page, "רונית בקרוב", "75", dayKey(3));
  await addDebt(page, "משה רחוק", "75", dayKey(30));

  await page.goto("/");
  const card = page.locator("[data-slot=card]").filter({
    hasText: "חובות שמועדם מתקרב",
  });
  await expect(card).toContainText("רונית בקרוב");
  await expect(card).not.toContainText("משה רחוק");
  await card.getByRole("button", { name: "כל החובות" }).click();
  await expect(page).toHaveURL(/view=debts/);
  await expect(row(page, "משה רחוק")).toBeVisible();
});

test("search finds a debt and opens it to edit", async ({ page }) => {
  await debtsTab(page);
  await addDebt(page, "נועה בחיפוש", "60");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/לחפש|חיפוש/).first().fill("נועה בחיפוש");
  await page.getByRole("option", { name: /נועה בחיפוש/ }).first().click();
  await expect(page.getByRole("dialog", { name: "עריכת חוב" })).toBeVisible();
});

test("the debts tab is accessible", async ({ page }) => {
  await debtsTab(page);
  await addDebt(page, "נגיש בבדיקה", "10");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .include("main")
    .analyze();
  expect(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
});
