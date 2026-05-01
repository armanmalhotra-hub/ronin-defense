#!/usr/bin/env node
// Batch screenshot runner for the watch-scouting skill.
// Walks a target list and writes PNGs into docs/watch-images/.
//
// Usage:
//   node shoot-watches.mjs               # shoot all targets
//   node shoot-watches.mjs kurono-inseki # shoot one by id
//
// Requires: playwright + chromium installed locally.
//   npm i -g playwright && npx playwright install chromium

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../docs/watch-images");
const SHOOTER = path.join(__dirname, "screenshot.mjs");

const TARGETS = [
  // === Primary buy candidates ===
  {
    id: "kurono-inseki",
    label: "Kurono Inseki 37mm meteorite (2026 Special Projects)",
    url: "https://kuronotokyo.com/pages/37mm-inseki",
    viewport: "1280x1100",
    full: true,
  },
  {
    id: "kurono-shiraai",
    label: "Kurono Jubilee Sensu EOL 'Shiraai' 白藍",
    url: "https://kuronotokyo.com/pages/2025-jubilee-sensu-eol",
    viewport: "1280x1100",
    full: true,
  },
  {
    id: "kurono-grand-urushi-aoyama",
    label: "Kurono Grand Urushi Aoyama (Brown Cinnamon trio)",
    url: "https://kuronotokyo.com/pages/grand-urushi-aoyama",
    viewport: "1280x1100",
    full: true,
  },
  {
    id: "naoya-hida-2026",
    label: "Naoya Hida & Co. — 2026 collection landing",
    url: "https://naoyahidawatch.com/?lang=en",
    viewport: "1280x1400",
    full: true,
  },
  {
    id: "naoya-hida-type-3a",
    label: "Naoya Hida NH Type 3A Moonphase reference",
    url: "https://naoyahidawatch.com/product/nh_type_3a/?lang=en",
    viewport: "1280x1400",
    full: true,
  },

  // === Atelier / salon location reference shots ===
  {
    id: "kurono-aoyama-salon",
    label: "Kurono Tokyo Aoyama Salon (Tokyo location page)",
    url: "https://kuronotokyo.com/pages/kurono-tokyo-aoyama-salon",
    viewport: "1280x1100",
    full: true,
  },

  // === Secondary-market price reference ===
  {
    id: "watchcharts-kurono",
    label: "WatchCharts — Kurono Tokyo current asks",
    url: "https://watchcharts.com/watches/brand/kurono+tokyo",
    viewport: "1280x1400",
    full: false,
  },
  {
    id: "everywatch-shiraai-listing",
    label: "EveryWatch — live Shiraai dealer listing",
    url: "https://everywatch.com/kurono/watch-15103911",
    viewport: "1280x1100",
    full: false,
  },

  // === Tier-2 candidates worth a look ===
  {
    id: "minase-divido-urushi",
    label: "Minase Divido Urushi (size check — 40.6mm, likely too big)",
    url: "https://minasewatches.com/webshop/divido-urushi-makie-rubber-2/",
    viewport: "1280x1100",
    full: true,
  },
  {
    id: "kikuchi-nakagawa-murakumo",
    label: "Kikuchi Nakagawa Murakumo (waitlist closed; reference)",
    url: "https://kikuchi-nakagawa.com/en/watches/murakumo/",
    viewport: "1280x1100",
    full: true,
  },
];

const filterId = process.argv[2];
const targets = filterId ? TARGETS.filter((t) => t.id === filterId) : TARGETS;
if (filterId && targets.length === 0) {
  console.error(`unknown id: ${filterId}`);
  console.error(`available: ${TARGETS.map((t) => t.id).join(", ")}`);
  process.exit(2);
}

const env = {
  ...process.env,
  // These two paths are the sandbox defaults; safe to leave on a normal box.
  NODE_PATH: process.env.NODE_PATH || "/opt/node22/lib/node_modules",
  PLAYWRIGHT_BROWSERS_PATH:
    process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers",
};

const results = [];
for (const t of targets) {
  const out = path.join(OUT_DIR, `${t.id}.png`);
  const args = [SHOOTER, t.url, out, "--viewport", t.viewport];
  if (t.full) args.push("--full");
  console.log(`→ ${t.id}: ${t.url}`);
  const res = spawnSync("node", args, { env, stdio: "inherit" });
  results.push({ id: t.id, label: t.label, url: t.url, ok: res.status === 0, out });
}

const okCount = results.filter((r) => r.ok).length;
console.log(`\n${okCount}/${results.length} screenshots written to ${OUT_DIR}`);
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.id} — ${r.label}`);
}
process.exit(okCount === results.length ? 0 : 1);
