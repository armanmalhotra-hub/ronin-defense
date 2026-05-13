#!/usr/bin/env node
// fetch-og-images.mjs — pull each watch's curated marketing photo via og:image.
//
// For each watch in dashboard/data.json:
//   1. Fetch its `url` (the brand or auction site)
//   2. Parse <meta property="og:image"> (or twitter:image, fallback to first <img>)
//   3. Download the image to docs/watch-images/<id>.{jpg|png|webp}
//
// Skips watches that already have an image. Uses --force to re-fetch.

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const DATA = path.join(REPO, "dashboard/data.json");
const OUT_DIR = path.join(REPO, "docs/watch-images");

const args = process.argv.slice(2);
const force = args.includes("--force");
const filterId = args.find((a) => !a.startsWith("--"));

const data = JSON.parse(await fs.readFile(DATA, "utf8"));
let watches = data.favorites || [];
if (filterId) watches = watches.filter((w) => w.id === filterId);

await fs.mkdir(OUT_DIR, { recursive: true });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function pickMeta(html, name) {
  // og:image, twitter:image, etc — case-insensitive
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function pickFirstImage(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function absolutize(url, base) {
  try { return new URL(url, base).href; } catch { return null; }
}

function extOf(contentType, url) {
  if (contentType) {
    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
    if (contentType.includes("avif")) return "avif";
  }
  const m = (url || "").match(/\.(png|webp|jpe?g|avif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

let ok = 0, fail = 0;
const failures = [];

for (const w of watches) {
  const baseOut = path.join(OUT_DIR, w.id);
  const existing = ["png", "jpg", "webp", "avif"].find((e) => existsSync(`${baseOut}.${e}`));
  if (existing && !force) {
    console.log(`✓ ${w.id} (cached .${existing})`);
    ok++;
    continue;
  }

  try {
    const resp = await fetch(w.url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!resp.ok) throw new Error(`page ${resp.status}`);
    const html = await resp.text();
    let imgUrl =
      pickMeta(html, "og:image") ||
      pickMeta(html, "og:image:secure_url") ||
      pickMeta(html, "twitter:image") ||
      pickMeta(html, "twitter:image:src") ||
      pickFirstImage(html);
    if (!imgUrl) throw new Error("no og:image / <img>");
    imgUrl = absolutize(imgUrl, w.url);
    if (!imgUrl) throw new Error("bad image url");

    const ir = await fetch(imgUrl, { headers: { "User-Agent": UA, "Referer": w.url } });
    if (!ir.ok) throw new Error(`image ${ir.status}`);
    const ct = ir.headers.get("content-type") || "";
    const ext = extOf(ct, imgUrl);
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length < 800) throw new Error("image suspiciously small");
    await fs.writeFile(`${baseOut}.${ext}`, buf);
    console.log(`✓ ${w.id} → ${ext} (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.log(`✗ ${w.id} — ${e.message}`);
    failures.push({ id: w.id, err: e.message });
    fail++;
  }
}

console.log(`\n${ok}/${watches.length} fetched (${fail} failed)`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(`  ${f.id} — ${f.err}`);
}
process.exit(fail === watches.length ? 1 : 0);
