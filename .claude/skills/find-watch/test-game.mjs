#!/usr/bin/env node
// Quick e2e smoke test for the Play tab.
// Spins up a local server (must be running already on :8770), drives the dashboard,
// and screenshots: empty Play, after-submit reveal.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL || "http://localhost:8770/";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1200 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);

// 1. Set a nickname
await page.fill("#nick-input", "tester");
await page.click("#nick-save");
await page.waitForTimeout(300);

// 2. Click Play tab
await page.click('nav.tabs .tab[data-tab="play"]');
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/play-1.png", fullPage: false });

// 3. Inspect: brand select + bucket select present?
const brandCount = await page.locator("#g-brand option").count();
const bucketCount = await page.locator("#g-bucket option").count();
console.log(`brand options: ${brandCount}, bucket options: ${bucketCount}`);

// 4. Pick first non-empty brand and bucket, then submit
await page.selectOption("#g-brand", { index: 1 });
await page.selectOption("#g-bucket", { index: 1 });
await page.click("#g-submit");
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/play-2.png", fullPage: false });

// 5. Verify reveal block exists
const revealText = await page.locator(".reveal").innerText().catch(() => "");
console.log(`reveal: ${revealText.slice(0, 120)}…`);

// 6. Click next round
const nextBtn = page.locator("#g-next");
const has = await nextBtn.count();
if (has) {
  await nextBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/play-3.png", fullPage: false });
  const newClue = await page.locator(".clue h3").innerText();
  console.log(`new round heading: ${newClue}`);
}

// 7. Survey tab smoke
await page.click('nav.tabs .tab[data-tab="survey"]');
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/survey.png", fullPage: true });
const surveyCards = await page.locator("#grid-surveys .card").count();
console.log(`survey cards: ${surveyCards}`);

await browser.close();
console.log("OK");
