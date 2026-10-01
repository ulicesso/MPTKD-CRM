/*
 * Takes screenshots of every page for visual review.
 * Usage: npm run build && npx vite preview --port 4173 &  then  node scripts/screenshots.mjs
 */
import { chromium } from "playwright-core";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:4173";
const OUT = process.env.OUT || "screenshots";
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function shoot(name, path, { width = 1360, height = 900, dark = false, full = true, before } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (before) await before(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
}

await shoot("dashboard", "/");
await shoot("leads", "/leads");
await shoot("pipeline", "/pipeline", { width: 1600 });
await shoot("analytics", "/analytics");
await shoot("families", "/families");
await shoot("lead-drawer", "/leads", { full: false, before: async (p) => { await p.locator("tbody tr").first().click(); } });
await shoot("lead-history", "/leads", { full: false, before: async (p) => { await p.locator("tbody tr").first().click(); await p.getByRole("tab", { name: /Contact history/ }).click(); } });
await shoot("family-detail", "/families", { before: async (p) => { await p.getByRole("combobox", { name: "Show" }).selectOption("both"); await p.locator("tbody tr").first().click(); } });
await shoot("new-inquiry", "/leads", { full: false, before: async (p) => { await p.getByRole("button", { name: "New inquiry" }).click(); } });
await shoot("dashboard-dark", "/", { dark: true });
await shoot("pipeline-dark", "/pipeline", { dark: true, width: 1600, full: false });
await shoot("phone-dashboard", "/", { width: 390, height: 844 });
await shoot("phone-leads", "/leads", { width: 390, height: 844, full: false });
await shoot("phone-pipeline", "/pipeline", { width: 390, height: 844, full: false });
await shoot("phone-analytics", "/analytics", { width: 390, height: 844 });
await shoot("phone-drawer", "/leads", { width: 390, height: 844, full: false, before: async (p) => { await p.locator(".card").first().click(); } });

await browser.close();
if (errors.length) { console.error("Page errors:\n" + errors.join("\n")); process.exit(1); }
console.log("Screenshots saved to", OUT);
