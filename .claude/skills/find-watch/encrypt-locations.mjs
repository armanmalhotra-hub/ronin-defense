#!/usr/bin/env node
// encrypt-locations.mjs — encrypt private "where to find" notes for the dashboard.
//
// Workflow (run on Arman's own machine):
//   1. Edit `private-locations.local.json` (gitignored) with plaintext entries:
//      { "kurono-shiraai": "Andy at Watch CTI Ginza, hold until June 14",
//        "kurono-inseki":  "DM @kurono_collector_x, preorder $2,400" }
//   2. Run: WATCH_PASS="<your passphrase>" node .claude/skills/find-watch/encrypt-locations.mjs
//   3. Script writes encrypted bundle to `dashboard/locations.enc.json`.
//   4. Commit `dashboard/locations.enc.json` (the plaintext .local.json stays gitignored).
//
// The dashboard only fetches locations.enc.json for owners (?owner=1 once on first visit).
// Friends never request this file and never see ciphertext anywhere.

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENC_FILE = path.resolve(__dirname, "../../../dashboard/locations.enc.json");
const PLAIN = path.resolve(__dirname, "../../../private-locations.local.json");
const ITER = 250000;

const pass = process.env.WATCH_PASS;
if (!pass) {
  console.error("Set WATCH_PASS env var with your passphrase.");
  process.exit(2);
}

let plain;
try { plain = JSON.parse(await fs.readFile(PLAIN, "utf8")); }
catch {
  console.error(`Create ${PLAIN} first. Format: { "watch-id": "your private note", ... }`);
  process.exit(2);
}

const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString("base64");

async function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const km = await crypto.webcrypto.subtle.importKey(
    "raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  const key = await crypto.webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ct = await crypto.webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(plaintext)
  );
  return `${b64(salt)}.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

const entries = {};
for (const [id, note] of Object.entries(plain)) {
  if (!note) continue;
  entries[id] = await encrypt(note, pass);
}

const bundle = {
  algo: "AES-GCM",
  kdf: "PBKDF2-SHA256",
  iterations: ITER,
  entries,
};

await fs.writeFile(ENC_FILE, JSON.stringify(bundle, null, 2) + "\n");
console.log(`Encrypted ${Object.keys(entries).length} entries to ${ENC_FILE}`);
