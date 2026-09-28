// Renders the app icon (one SVG) to the PNG sizes a home screen asks for,
// with the Chromium that Playwright already installed. Run after changing
// the drawing: node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const TEAL = "#00745f";
const PAPER = "#fdfaf3";

// A calendar page with a tick: days, tasks, done.
function drawing(safe = 1) {
  // `safe` shrinks the drawing for maskable icons, whose edges may be cut.
  const s = 0.62 * safe;
  const o = (1 - s) / 2;
  const at = (v) => (o + v * s) * 512;
  return `
    <rect x="${at(0)}" y="${at(0.08)}" width="${s * 512}" height="${0.92 * s * 512}" rx="${0.14 * s * 512}" fill="${PAPER}"/>
    <rect x="${at(0)}" y="${at(0.08)}" width="${s * 512}" height="${0.26 * s * 512}" rx="${0.14 * s * 512}" fill="${PAPER}"/>
    <rect x="${at(0)}" y="${at(0.24)}" width="${s * 512}" height="${0.1 * s * 512}" fill="${TEAL}" opacity="0.18"/>
    <rect x="${at(0.22)}" y="${at(0)}" width="${0.1 * s * 512}" height="${0.2 * s * 512}" rx="${0.05 * s * 512}" fill="${PAPER}"/>
    <rect x="${at(0.68)}" y="${at(0)}" width="${0.1 * s * 512}" height="${0.2 * s * 512}" rx="${0.05 * s * 512}" fill="${PAPER}"/>
    <path d="M ${at(0.26)} ${at(0.62)} L ${at(0.44)} ${at(0.8)} L ${at(0.76)} ${at(0.46)}"
      fill="none" stroke="${TEAL}" stroke-width="${0.11 * s * 512}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function svg({ maskable = false } = {}) {
  const radius = maskable ? 0 : 112;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${radius}" fill="${TEAL}"/>
    ${drawing(maskable ? 0.8 : 1)}
  </svg>`;
}

const outputs = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/maskable-512.png", size: 512, maskable: true },
  { file: "src/app/apple-icon.png", size: 180, maskable: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, maskable } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px">${svg({ maskable }).replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>
    </body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
  console.log("wrote", file);
}
await browser.close();

// The favicon: the same drawing as an SVG, which Next.js serves as /icon.svg.
writeFileSync("src/app/icon.svg", svg());
console.log("wrote src/app/icon.svg");
