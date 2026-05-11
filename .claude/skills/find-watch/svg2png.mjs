#!/usr/bin/env node
// Convert local SVG files to PNG using headless Chromium.
// Usage: node svg2png.mjs <input.svg> <output.png>

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [inSvg, outPng] = process.argv.slice(2);
if (!inSvg || !outPng) {
  console.error("usage: svg2png.mjs <input.svg> <output.png>");
  process.exit(2);
}
const svgPath = path.resolve(inSvg);
const outPath = path.resolve(outPng);
await fs.mkdir(path.dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 800, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(svgPath).href);
await page.waitForTimeout(300);
const svg = await page.locator("svg").first();
await svg.screenshot({ path: outPath, omitBackground: false });
await browser.close();
console.log(outPath);
