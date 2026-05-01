#!/usr/bin/env node
// Batch screenshot runner — pulls every watch in dashboard/data.json
// and screenshots its `url` field, saving to docs/watch-images/<id>.png.
//
// Usage:
//   node shoot-watches.mjs               # shoot every watch (skip ones already shot)
//   node shoot-watches.mjs <id>          # shoot one specific watch by id
//   node shoot-watches.mjs --force       # re-shoot everything, overwriting existing
//
// Designed to run from a CI runner (GitHub Actions / Vercel / a laptop)
// where the network isn't sandboxed. Uses Playwright + Chromium.

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(REPO_ROOT, "dashboard/data.json");
const OUT_DIR = path.join(REPO_ROOT, "docs/watch-images");
const SHOOTER = path.join(__dirname, "screenshot.mjs");

const args = process.argv.slice(2);
const force = args.includes("--force");
const filterId = args.find((a) => !a.startsWith("--"));

const data = JSON.parse(await fs.readFile(DATA, "utf8"));
const watches = data.favorites || [];

let targets = watches.map((w) => ({
  id: w.id,
  label: `${w.brand} — ${w.model}`,
  url: w.url,
  viewport: "1280x1100",
  full: true,
}));

if (filterId) {
  targets = targets.filter((t) => t.id === filterId);
  if (!targets.length) {
    console.error(`unknown id: ${filterId}`);
    process.exit(2);
  }
}

const env = {
  ...process.env,
  NODE_PATH: process.env.NODE_PATH || "/opt/node22/lib/node_modules",
  PLAYWRIGHT_BROWSERS_PATH:
    process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers",
};

await fs.mkdir(OUT_DIR, { recursive: true });

const results = [];
for (const t of targets) {
  const out = path.join(OUT_DIR, `${t.id}.png`);
  if (!force && existsSync(out)) {
    console.log(`✓ ${t.id} (cached)`);
    results.push({ ...t, ok: true, cached: true });
    continue;
  }
  console.log(`→ ${t.id}: ${t.url}`);
  const res = spawnSync(
    "node",
    [SHOOTER, t.url, out, "--viewport", t.viewport, t.full ? "--full" : ""].filter(Boolean),
    { env, stdio: "inherit" }
  );
  results.push({ ...t, ok: res.status === 0 });
}

const ok = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\n${ok}/${results.length} screenshots in ${OUT_DIR}`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  ✗ ${f.id} — ${f.label}`);
}
process.exit(failed.length ? 1 : 0);
