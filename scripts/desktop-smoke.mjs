// Desktop smoke test: drives the built Tauri app through WebView2's debug
// port. Build the test app first (npm run build:desktop-test), then:
//   node scripts/desktop-smoke.mjs write [shot.png]   add, tick, delete tasks
//   node scripts/desktop-smoke.mjs read  [shot.png]   restart and check them
//   node scripts/desktop-smoke.mjs first-run          name, sample data, removal
//   node scripts/desktop-smoke.mjs services           calendar, Claude, backups
//   node scripts/desktop-smoke.mjs shell              tray, reminder, one instance
//   node scripts/desktop-smoke.mjs screenshots        README pictures, sample data
// first-run needs a fresh data folder; services connects a public calendar
// and a fake Claude key, and removes both at the end.
// The test app has its own identifier (src-tauri/tauri.test.conf.json), so it
// keeps its data in its own folder and never touches the installed app's.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const read = (file) =>
  JSON.parse(readFileSync(new URL(`../src-tauri/${file}`, import.meta.url), "utf8"));
const TEST = read("tauri.test.conf.json");
const EXE = path.join(
  fileURLToPath(new URL("..", import.meta.url)),
  `src-tauri/target/release/${TEST.mainBinaryName}.exe`,
);
// Where the test app keeps its data; the installed app's folder is never used.
const DATA = path.join(process.env.APPDATA, TEST.identifier);
if (!existsSync(EXE)) {
  console.error(`no test build at ${EXE} — run npm run build:desktop-test`);
  process.exit(1);
}
const PORT = 9333;
const CONF = read("tauri.conf.json").app.windows[0];
const APP_ARGS = CONF.additionalBrowserArgs;
const phase = process.argv[2];

function stopApp() {
  // Only this build, never some other program that is named the same.
  const ps = `Get-Process ${TEST.mainBinaryName} -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${EXE}' } | Stop-Process -Force`;
  try {
    execSync("powershell -NoProfile -EncodedCommand " + Buffer.from(ps, "utf16le").toString("base64"), { stdio: "ignore" });
  } catch {}
}

// Whatever happens — a failed step included — the test app doesn't stay open.
process.on("exit", stopApp);

async function launch() {
  stopApp();
  await new Promise((r) => setTimeout(r, 800));
  const started = Date.now();
  const child = spawn(EXE, [], {
    detached: true,
    stdio: "ignore",
    // The variable replaces the window's own arguments (tauri.conf.json), so
    // they are repeated here with the debug port.
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${APP_ARGS} --remote-debugging-port=${PORT}`,
      // Notifications and links are recorded, never shown (shell.rs).
      MANAGEMENT_SMOKE_QUIET: "1",
    },
  });
  child.unref();
  let browser;
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!browser) throw new Error("no debug port");
  // The debug port can answer before the window has loaded the app.
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((p) => p.url().startsWith("http://tauri.localhost"));
    if (!page) await new Promise((r) => setTimeout(r, 200));
  }
  if (!page) throw new Error("the app's page never loaded");
  await page.waitForLoadState("load");
  await page.locator("[data-skeleton]").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-skeleton]"), null, { timeout: 15000 });
  console.log(`ready in ${((Date.now() - started) / 1000).toFixed(2)}s at ${page.url()}`);
  return { browser, page };
}

async function goto(page, path) {
  const origin = new URL(page.url()).origin;
  // A full reload cuts off calls to Rust still in flight, and Tauri logs
  // that ("Couldn't find callback id"). The app itself never reloads; let
  // the calls finish first.
  await page.waitForLoadState("networkidle").catch(() => {});
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
} else if (phase === "screenshots") {
  // The README's pictures: a fresh data folder, a sample name, sample data,
  // light theme, the window's own size.
  await page.evaluate(() => {
    localStorage.setItem("lior-device", JSON.stringify({ autoBrief: false, fired: {} }));
    localStorage.setItem("theme", "light");
  });
  await goto(page, "/");
  const dialog = page.getByRole("dialog", { name: /ברוכים הבאים/ });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByLabel("איך לקרוא לך?").fill("דנה");
  await dialog.getByRole("button", { name: "המשך" }).click();
  await page.getByRole("button", { name: "עם נתוני דוגמה" }).click();
  await page.getByText("מוצגים נתוני דוגמה.").waitFor();
  const out = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
  const shots = { today: "/", tasks: "/tasks/", calendar: "/calendar/", finance: "/finance/", settings: "/settings/?tab=connections" };
  for (const [name, route] of Object.entries(shots)) {
    await goto(page, route);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
  console.log("screenshots:", Object.keys(shots).join(", "));
} else if (phase === "first-run") {
  const seen = {};
  // This device may have answered on an earlier run; forget that here (the
  // data folder still has to be fresh).
  await page.evaluate(() => {
    const device = JSON.parse(localStorage.getItem("lior-device") ?? "{}");
    delete device.onboarded;
    // In the daytime the morning brief would open over the page.
    device.autoBrief = false;
    localStorage.setItem("lior-device", JSON.stringify(device));
  });
  await goto(page, "/");
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

  const backups = path.join(DATA, "backups");
  seen.backups = existsSync(backups) ? readdirSync(backups) : [];
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("seen:", seen);
} else if (phase === "shell") {
  const seen = {};
  const ps = (script) =>
    execSync("powershell -NoProfile -EncodedCommand " + Buffer.from("$ProgressPreference='SilentlyContinue'; " + script, "utf16le").toString("base64"), { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const instances = () => Number(ps(`@(Get-Process ${TEST.mainBinaryName} -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${EXE}' }).Count`));

  // A task with a reminder one minute before it, due three minutes out: the
  // time drops its seconds, and the reminder must come after the window has
  // gone to the tray.
  const due = new Date(Date.now() + 3 * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
  const time = `${pad(due.getHours())}:${pad(due.getMinutes())}`;
  // A new id each run: a reminder that fired once is never shown again.
  const taskId = `smoke-reminder-${Date.now()}`;
  await page.evaluate(
    ([id, date, time]) =>
      window.__TAURI_INTERNALS__.invoke("db_run", {
        sql: "INSERT INTO tasks (id,title,dueDate,dueTime,priority,completed,reminder,createdAt,updatedAt) VALUES (?,'עשן תזכורת',?,?,'normal',0,1,datetime('now'),datetime('now'))",
        params: [id, date, time],
      }),
    [taskId, date, time],
  );
  await goto(page, "/");
  // Notifications and links are recorded by Rust, not sent (quiet mode, set
  // in launch()): a test stays silent and opens no browser.
  const recorded = async (prefix) =>
    (await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("shell_quiet_calls"))).filter((c) => c.startsWith(prefix));

  // A link out of the app goes to the default browser.
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "https://example.com/";
    a.textContent = "קישור החוצה";
    a.id = "smoke-link";
    document.querySelector("main").append(a);
  });
  await page.evaluate(() => document.getElementById("smoke-link").click());
  seen.linkStayed = page.url().startsWith("http://tauri.localhost");
  await page.waitForTimeout(500);
  seen.linkOpened = await recorded("open:");

  // The extra backup folder gets a copy of today's backup.
  const extra = path.join(process.env.TEMP, `management-backup-smoke-${Date.now()}`);
  await page.evaluate(
    ([label, also]) => window.__TAURI_INTERNALS__.invoke("db_backup", { label, also }),
    [date, extra],
  );
  seen.extraBackup = existsSync(extra) ? readdirSync(extra) : [];
  rmSync(extra, { recursive: true, force: true });

  // Closing the window (WM_CLOSE, as its X button sends) keeps the app in
  // the tray.
  // The window's handle, taken while it shows (a hidden window is no
  // process's "main window").
  const handle = ps(`(Get-Process ${TEST.mainBinaryName} | Where-Object { $_.Path -eq '${EXE}' } | Select-Object -First 1).MainWindowHandle`);
  const WIN = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class W { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); }'; $h = [IntPtr]${handle};`;
  seen.window = { handle, visibleBefore: ps(`${WIN} [W]::IsWindowVisible($h)`) === "True" };
  const windowVisible = () => ps(`${WIN} [W]::IsWindowVisible($h)`) === "True";
  ps(`${WIN} [void][W]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)`);
  await page.waitForTimeout(1500);
  seen.afterClose = { running: instances(), windowVisible: windowVisible(), visibility: await page.evaluate(() => document.visibilityState) };

  // The reminder comes while it's there.
  const deadline = Date.now() + 200_000;
  let notified = [];
  while (Date.now() < deadline && notified.length === 0) {
    await page.waitForTimeout(2000);
    notified = await recorded("notify:");
  }
  seen.reminder = notified;
  seen.reminderWhileHidden = !windowVisible();
  seen.reminderFired = await page.evaluate(() =>
    (id) => Object.keys(JSON.parse(localStorage.getItem("lior-device") ?? "{}").fired ?? {}).filter((k) => k.includes(id)),
    taskId,
  );

  // A second launch brings the running one back, and doesn't stay.
  spawn(EXE, [], { detached: true, stdio: "ignore" }).unref();
  await page.waitForTimeout(4000);
  seen.secondLaunch = { running: instances(), windowVisible: windowVisible(), visibility: await page.evaluate(() => document.visibilityState) };

  await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("db_run", { sql: "DELETE FROM tasks WHERE id LIKE 'smoke-reminder%'", params: [] }),
  );
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("seen:", JSON.stringify(seen, null, 1));
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
  // The calendar, not Today: the write phase may have run on another day.
  await goto(page, "/calendar/");
  seen.event = await page.getByText("עשן אירוע").count();
  await goto(page, "/finance/");
  seen.transaction = await page.getByText("עשן תנועה").count();
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log("seen:", seen);
}
console.log("console warnings/errors:", warnings.length ? warnings : "none");
await browser.close().catch(() => {});
if (phase !== "write") stopApp();
