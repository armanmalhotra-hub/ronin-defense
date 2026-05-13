#!/usr/bin/env node
// Bundle the dashboard into a single self-contained HTML file.
// Inlines: CSS, JS, data.json, locations.enc.json, vendored Leaflet.
//
// Output: dashboard/watch-watch.html — open in any browser, no server needed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const DASH = path.join(REPO, "dashboard");

const read = (p) => fs.readFile(p, "utf8");

const html = await read(path.join(DASH, "index.html"));
const css = await read(path.join(DASH, "style.css"));
const appJs = await read(path.join(DASH, "app.js"));
const configJs = await read(path.join(DASH, "config.js"));
const dataJson = await read(path.join(DASH, "data.json"));
const locsJson = await read(path.join(DASH, "locations.enc.json"))
  .catch(() => '{"algo":"AES-GCM","kdf":"PBKDF2-SHA256","iterations":250000,"entries":{}}');

const leafletCss = await read(path.join(DASH, "vendor/leaflet.css"));
const leafletJs  = await read(path.join(DASH, "vendor/leaflet.js"));

// Patch app.js: replace runtime fetches of data.json + locations.enc.json
// with synchronous reads from window globals.
const patchedAppJs = appJs
  .replace(
    `data = await (await fetch("./data.json", { cache: "no-store" })).json();`,
    `data = JSON.parse(JSON.stringify(window.__WW_DATA));`
  )
  .replace(
    `const r = await fetch("./locations.enc.json", { cache: "no-store" });
    if (!r.ok) return null;
    PRIVATE.bundle = await r.json();`,
    `PRIVATE.bundle = JSON.parse(JSON.stringify(window.__WW_LOCATIONS));`
  );

let bundled = html
  // Replace external stylesheet refs with inlined <style>
  .replace(
    /<link rel="stylesheet" href="\.\/vendor\/leaflet\.css"\/>/,
    `<style id="leaflet-css">${leafletCss}</style>`
  )
  .replace(
    /<link rel="stylesheet" href="\.\/style\.css"\/>/,
    `<style id="ww-css">${css}</style>`
  )
  // Replace external scripts with inlined <script>
  .replace(
    /<script src="\.\/vendor\/leaflet\.js" defer><\/script>/,
    `<script>${leafletJs}</script>`
  )
  .replace(
    /<script src="\.\/config\.js" defer><\/script>\s*<script src="\.\/app\.js" defer><\/script>/,
    `<script id="ww-data" type="application/json">${dataJson}</script>
<script id="ww-locs" type="application/json">${locsJson}</script>
<script>
window.__WW_DATA = JSON.parse(document.getElementById("ww-data").textContent);
window.__WW_LOCATIONS = JSON.parse(document.getElementById("ww-locs").textContent);
${configJs}
${patchedAppJs}
</script>`
  );

const out = path.join(DASH, "watch-watch.html");
await fs.writeFile(out, bundled);

const stat = await fs.stat(out);
console.log(`Bundled → ${out} (${(stat.size / 1024).toFixed(1)} KB)`);
