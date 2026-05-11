#!/usr/bin/env node
// Headless screenshot helper for the find-watch skill.
// Usage:
//   node screenshot.mjs <url> <out.png> [--full] [--selector "<css>"] [--viewport WxH]
//
// Env requirements (set automatically if missing here):
//   NODE_PATH=/opt/node22/lib/node_modules
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error("usage: screenshot.mjs <url> <out.png> [--full] [--selector \"<css>\"] [--viewport WxH] [--wait ms]");
  process.exit(2);
}

const url = argv[0];
const outPath = path.resolve(argv[1]);
const full = argv.includes("--full");
const selectorIdx = argv.indexOf("--selector");
const selector = selectorIdx >= 0 ? argv[selectorIdx + 1] : null;
const viewportIdx = argv.indexOf("--viewport");
const viewport = viewportIdx >= 0 ? argv[viewportIdx + 1] : "1280x900";
const waitIdx = argv.indexOf("--wait");
const extraWait = waitIdx >= 0 ? parseInt(argv[waitIdx + 1], 10) : 1500;
const [vw, vh] = viewport.split("x").map((n) => parseInt(n, 10));

await fs.mkdir(path.dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: vw, height: vh },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  locale: "en-US",
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
} catch (e) {
  // Some sites never reach networkidle; fall back to domcontentloaded.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
}
await page.waitForTimeout(extraWait);

if (selector) {
  const el = await page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: outPath });
} else {
  await page.screenshot({ path: outPath, fullPage: full });
}

await browser.close();
console.log(outPath);
