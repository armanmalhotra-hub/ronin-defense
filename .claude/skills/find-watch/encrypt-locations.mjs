#!/usr/bin/env node
// encrypt-locations.mjs — encrypt private "where to find" notes for the dashboard.
//
// Workflow:
//   1. Edit `private-locations.local.json` (gitignored) with plaintext entries:
//      { "kurono-shiraai": "Andy at Watch CTI Ginza has held one for me since...",
//        "kurono-inseki":  "DM @kurono_collector_x on IG, reserve at $2.4k" }
//   2. Run: WATCH_PASS="your passphrase" node .claude/skills/find-watch/encrypt-locations.mjs
//   3. Script reads dashboard/data.json + private-locations.local.json,
//      encrypts each entry with AES-GCM (key = PBKDF2(pass, per-entry salt)),
//      writes the ciphertext into the matching watch's `private_cipher` field,
//      and saves data.json.
//   4. Commit data.json. The plaintext file stays local; only the ciphertext is committed.
//
// Browser side decrypts with the same passphrase via Web Crypto.

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../../../dashboard/data.json");
const PLAIN = path.resolve(__dirname, "../../../private-locations.local.json");

const pass = process.env.WATCH_PASS;
if (!pass) {
  console.error("Set WATCH_PASS env var with your passphrase.");
  process.exit(2);
}

const data = JSON.parse(await fs.readFile(DATA, "utf8"));
let plain;
try { plain = JSON.parse(await fs.readFile(PLAIN, "utf8")); }
catch {
  console.error(`Create ${PLAIN} first. Format: { "watch-id": "your private note", ... }`);
  process.exit(2);
}

const ITER = data.private_locations_meta?.iterations || 250000;
const enc = new TextEncoder();

function b64(buf) { return Buffer.from(buf).toString("base64"); }

async function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const keyMaterial = await crypto.webcrypto.subtle.importKey(
    "raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  const key = await crypto.webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ct = await crypto.webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return `${b64(salt)}.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

let count = 0;
for (const w of data.favorites) {
  const note = plain[w.id];
  if (note == null) continue;
  w.private_cipher = await encrypt(note, pass);
  count++;
}

await fs.writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
console.log(`Encrypted ${count} entries into dashboard/data.json`);
console.log(`Don't forget to .gitignore ${path.basename(PLAIN)}`);
