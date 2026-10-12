// Desktop smoke test: drives the built Tauri app through WebView2's debug
// port. Build first (npm run tauri build), then:
//   node scripts/desktop-smoke.mjs write [shot.png]   add, tick, delete tasks
//   node scripts/desktop-smoke.mjs read  [shot.png]   restart and check them
// It uses the app's real data folder, so run it on a test machine or account.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import path from "node:path";

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
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("write done");
} else {
  await goto(page, "/tasks/");
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("visible:", {
    kept: await page.getByText("ד0 נשארת").count(),
    deleted: await page.getByText("ד0 נמחקת").count(),
  });
}
console.log("console warnings/errors:", warnings.length ? warnings : "none");
await browser.close().catch(() => {});
if (phase === "read") stopApp();
