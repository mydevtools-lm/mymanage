// Desktop smoke test: drives the built Tauri app through WebView2's debug
// port. Build first (npm run tauri build), then:
//   node scripts/desktop-smoke.mjs write [shot.png]   add, tick, delete tasks
//   node scripts/desktop-smoke.mjs read  [shot.png]   restart and check them
//   node scripts/desktop-smoke.mjs first-run          name, sample data, removal
//   node scripts/desktop-smoke.mjs services           calendar, Claude, backups
// first-run needs a fresh data folder; services connects a public calendar
// and a fake Claude key, and removes both at the end.
// It uses the app's real data folder, so run it on a test machine or account.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const EXE = path.join(
  fileURLToPath(new URL("..", import.meta.url)),
  "src-tauri/target/release/app.exe",
);
const PORT = 9333;
const phase = process.argv[2];

function stopApp() {
  // Only this build, never some other program that is also called app.exe.
  const ps = `Get-Process app -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${EXE}' } | Stop-Process -Force`;
  try {
    execSync("powershell -NoProfile -EncodedCommand " + Buffer.from(ps, "utf16le").toString("base64"), { stdio: "ignore" });
  } catch {}
}

async function launch() {
  stopApp();
  await new Promise((r) => setTimeout(r, 800));
  const started = Date.now();
  const child = spawn(EXE, [], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  });
  child.unref();
  let browser;
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!browser) throw new Error("no debug port");
  const page = browser.contexts()[0].pages()[0];
  await page.waitForLoadState("load");
  await page.locator("[data-skeleton]").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-skeleton]"), null, { timeout: 15000 });
  console.log(`ready in ${((Date.now() - started) / 1000).toFixed(2)}s at ${page.url()}`);
  return { browser, page };
}

async function goto(page, path) {
  const origin = new URL(page.url()).origin;
  await page.goto(origin + path);
  await page.waitForFunction(() => !document.querySelector("[data-skeleton]"), null, { timeout: 15000 });
}

const warnings = [];
const { browser, page } = await launch();
page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warnings.push(m.text()); });

if (phase === "write") {
  await goto(page, "/tasks/");
  for (const title of ["ד0 נשארת", "ד0 מסומנת", "ד0 נמחקת"]) {
    if (await page.getByText(title).count()) continue; // a previous run made it
    await page.getByRole("button", { name: "משימה חדשה" }).first().click();
    const dialog = page.getByRole("dialog", { name: "משימה חדשה" });
    await dialog.getByPlaceholder("מה צריך לעשות?").fill(title);
    await dialog.getByRole("button", { name: "הוספה" }).click();
    await page.getByText(title).first().waitFor();
  }
  const tick = page.getByRole("checkbox", { name: "סימון ד0 מסומנת" }).first();
  if (await tick.count()) await tick.click();
  // The row is the nearest ancestor of its checkbox that holds its actions.
  const row = page
    .getByRole("checkbox", { name: "סימון ד0 נמחקת" })
    .first()
    .locator('xpath=ancestor::*[.//button[@aria-label="פעולות" or @aria-label="מחיקה"]][1]');
  await row.hover();
  const direct = row.getByRole("button", { name: "מחיקה" });
  if (await direct.count()) await direct.first().click();
  else {
    await row.getByRole("button", { name: "פעולות" }).first().click();
    await page.getByRole("menuitem", { name: "מחיקה" }).click();
  }
  await page.waitForTimeout(7000); // past the undo window

  await goto(page, "/calendar/");
  if (!(await page.getByText("עשן אירוע").count())) {
    await page.getByRole("button", { name: "אירוע חדש" }).first().click();
    const dialog = page.getByRole("dialog", { name: "אירוע חדש" });
    await dialog.getByLabel("כותרת").fill("עשן אירוע");
    await dialog.getByLabel("שעת התחלה").fill("23:30");
    await dialog.getByRole("button", { name: "הוספה" }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  await goto(page, "/finance/");
  if (!(await page.getByText("עשן תנועה").count())) {
    await page.getByRole("button", { name: "תנועה חדשה" }).first().click();
    const dialog = page.getByRole("dialog", { name: "תנועה חדשה" });
    await dialog.getByLabel("סכום (₪)").fill("150");
    await dialog.getByLabel("תיאור (רשות)").fill("עשן תנועה");
    await dialog.getByRole("button", { name: "הוספה" }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("write done");
} else if (phase === "first-run") {
  const seen = {};
  const dialog = page.getByRole("dialog", { name: /ברוכים הבאים/ });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByLabel("איך לקרוא לך?").fill("בודקת");
  await dialog.getByRole("button", { name: "המשך" }).click();
  await page.getByRole("button", { name: "עם נתוני דוגמה" }).click();
  await page.getByText("מוצגים נתוני דוגמה.").waitFor();
  await goto(page, "/");
  seen.greeting = await page.getByText(/, בודקת ·/).count();
  seen.sampleEvent = await page.getByText("ארוחת צהריים עם דנה").count();
  await page.getByRole("button", { name: "למחוק את הדוגמה" }).click();
  await page.getByText("מוצגים נתוני דוגמה.").waitFor({ state: "detached" });
  seen.sampleLeft = await page.getByText("ארוחת צהריים עם דנה").count();
  // Answered once: a restart doesn't ask again.
  await browser.close().catch(() => {});
  const again = await launch();
  await again.page.waitForTimeout(1500);
  seen.askedAgain = await again.page.getByRole("dialog", { name: /ברוכים הבאים/ }).count();
  if (process.argv[3]) await again.page.screenshot({ path: process.argv[3] });
  await again.browser.close().catch(() => {});
  console.log("seen:", seen);
} else if (phase === "services") {
  const seen = {};
  // A public calendar (not a secret), standing in for a private address.
  const HOLIDAYS =
    "https://calendar.google.com/calendar/ical/en.jewish%23holiday%40group.v.calendar.google.com/public/basic.ics";
  await goto(page, "/settings/?tab=connections");
  await page.getByLabel("כתובת סודית בפורמט iCal").fill(HOLIDAYS);
  await page.getByLabel("שם לתצוגה (רשות)").fill("חגים");
  await page.getByRole("button", { name: "חיבור", exact: true }).click();
  await page.getByRole("region", { name: "חגים" }).waitFor({ timeout: 20000 });
  seen.calendar = (await page.getByRole("region", { name: "חגים" }).innerText())
    .split(/\r?\n/)
    .slice(0, 2)
    .join(" | ");
  // The address never comes back to the page.
  seen.addressOnPage = (await page.content()).includes("en.jewish");

  await page.getByLabel("מפתח API").fill("sk-ant-test-not-a-real-key");
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.getByText("המפתח נשמר").waitFor();
  seen.claudeBadge = await page.getByText("החלפת מפתח").count();

  await page.keyboard.press("Control+k");
  await page.keyboard.type("מחר בשעה 10 פגישה עם רואה חשבון");
  await page.getByRole("option", { name: /^להוסיף:/ }).click();
  const smart = page.getByRole("dialog", { name: "הוספה במשפט" });
  seen.smartAdd = await smart.getByRole("status").innerText({ timeout: 30000 });
  await page.keyboard.press("Escape");

  // Clean up: the fake key and the public calendar go.
  await page.getByRole("button", { name: "הסרת המפתח" }).click();
  await page.getByText("המפתח הוסר").waitFor();
  await page.getByRole("region", { name: "חגים" }).getByRole("button", { name: "ניתוק" }).click();
  await page.getByRole("region", { name: "חגים" }).waitFor({ state: "detached" });
  seen.cleanedUp = true;

  const backups = path.join(process.env.APPDATA, "io.github.mydevtools-lm.management", "backups");
  seen.backups = existsSync(backups) ? readdirSync(backups) : [];
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("seen:", seen);
} else {
  // After a restart: what was written is still there, on every screen.
  const seen = {};
  for (const path of ["/", "/tasks/", "/calendar/", "/finance/", "/notes/", "/settings/"]) {
    await goto(page, path);
    seen[path] = "ok";
  }
  await goto(page, "/tasks/");
  seen.taskKept = await page.getByText("ד0 נשארת").count();
  seen.taskDeleted = await page.getByText("ד0 נמחקת").count();
  await goto(page, "/");
  seen.event = await page.getByText("עשן אירוע").count();
  await goto(page, "/finance/");
  seen.transaction = await page.getByText("עשן תנועה").count();
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("seen:", seen);
}
console.log("console warnings/errors:", warnings.length ? warnings : "none");
await browser.close().catch(() => {});
if (phase !== "write") stopApp();
