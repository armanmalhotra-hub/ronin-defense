---
name: find-watch
description: Find watches matching Arman's preference profile (Japanese independents, 34-37mm, leather/rubber, no chronograph, warm tones). Also maintains the friend-group dashboard at `dashboard/` (cities/stores/brands/sellers/favorites). Use when the user asks to find/recommend/scout watches, check drop windows, monitor secondary-market prices, evaluate a specific watch, or update the dashboard. Examples - "find me a watch", "any new Kurono drops?", "is the [X] a fit?", "add this store to the dashboard", "publish the dashboard".
---

# Find Watch

Source of truth for preferences: `docs/watch-profile.md`. Always re-read it at the start of a search — it changes.

## When invoked

Decide which mode the user wants. If unclear, ask one short question.

1. **Scout** — "find me something" / "what's out there right now"
2. **Evaluate** — user names a specific watch, judge fit
3. **Drop watch** — check known purchase windows (Naoya Hida lottery, Kurono salon drops)
4. **Price check** — monitor a target piece on secondary market

## Scout workflow

1. Read `docs/watch-profile.md` fully.
2. Search across the brand tiers and secondary-market sources listed in the profile. Use WebSearch + WebFetch. Hit Tier 1 first (Kurono, Naoya Hida), then Tier 2, then Tier 3. Don't waste turns on rejected brands.
3. Useful query patterns:
   - `"<brand>" 2026 release`, `"<brand>" new model`
   - `site:chrono24.com <brand>`, `site:shop.getbezel.com <brand>`
   - `"Kurono" secondary market`, `"Naoya Hida" available`
   - `Japanese independent watchmaker 36mm <year>` — for fresh discoveries
4. For each candidate, extract: brand, model, case size, dial, strap, complication, production count, price (retail + secondary), source URL, availability.
5. Filter against MUST-HAVE criteria. Drop anything that fails (chronograph, >38mm, metal-only bracelet, rejected brand, Chinese, mainstream Swiss with logo).
6. Score remaining candidates 0-10:
   - +3 Japanese independent
   - +2 case 34-37mm (+1 for 37-38mm)
   - +2 warm/muted palette or white+colored accent
   - +1 urushi / lacquer / enamel / guilloche / sector dial
   - +1 production under 500
   - +1 no logo on dial
   - +1 power reserve or moonphase
   - −2 over $5,000 (unless dream-tier piece)
   - −1 obvious dupe of something he already rejected
7. Return top 3-5 ranked. For each: one-line pitch, why it fits, price, where to buy, link. Flag any in active drop window.

## Evaluate workflow

User gives a watch. Pull specs (WebFetch the brand page or a reputable review). Check it against MUST-HAVE rules first — if it fails, say so plainly and stop. Otherwise score it as above and give a verdict: **buy / consider / skip**, with the single biggest reason.

## Drop watch workflow

- **Naoya Hida 2026 lottery:** May 18-21, 2026. ORDER tab appears on naoyahidawatch.com on May 18. Target: Type 3A moonphase, Type 8A (31mm, new 2026). If today is within 7 days of May 18, surface this proactively in any response.
- **Kurono Shiraai:** monitor for secondary market softening below $2,500.
- For any drop: WebFetch the brand site, report whether ORDER/drop is live, list available references and prices, flag if anything matches the profile.

## Price check workflow

Use WatchCharts, Chrono24, EveryWatch, Bezel, Wristcheck. Report current ask range, recent sold comps if available, and whether it crossed his target threshold.

## Hard rules — never violate

- Never recommend: chronographs, Seiko/Orient/Citizen/Casio (incl. Presage, King Seiko), Chinese brands, MING, Baltic, Furlan Marri, Atelier Wen, Wancher, Kiwame Tokyo, Otsuka Lotec, Takano Chateau Nouvelle, Kuoe Kyoto.
- Never recommend a watch with a metal-bracelet-only configuration.
- Never recommend a chronograph, even if it otherwise fits.
- Don't pad a list — if only 1 watch fits, return 1.
- Don't fabricate prices, production numbers, or availability. If a number isn't in a fetched source, say "unverified" rather than guess.

## Output format

```
### <Brand> <Model>
- Size / strap / dial / complication
- Production: <N pieces> (if known)
- Price: <retail> retail / <range> secondary
- Fit score: X/10 — <one-line why>
- Where: <link>
- Status: <available / sold out / in drop window / lottery>
```

End with one sentence: what to do next (bid / wait / set alert / enter lottery).

## Screenshots (always include when scouting/evaluating)

Renderings matter — text-only recs are not actionable. After shortlisting candidates, pull live photos via the bundled headless-browser helper.

- One-shot:
  ```
  NODE_PATH=/opt/node22/lib/node_modules \
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node .claude/skills/find-watch/screenshot.mjs <url> docs/watch-images/<id>.png --full --viewport 1280x1100
  ```
- Batch (preferred — reuses the curated target list):
  ```
  node .claude/skills/find-watch/shoot-watches.mjs            # all targets
  node .claude/skills/find-watch/shoot-watches.mjs kurono-inseki  # one
  ```
- To add a new candidate, append it to the `TARGETS` array in `shoot-watches.mjs` with a stable `id`, `label`, `url`, `viewport`, and `full` flag.

After running, embed the resulting PNGs in the response with `![label](docs/watch-images/<id>.png)` so the user sees the actual watch, not just a link.

### Sandbox caveat
The Claude Code sandbox this repo lives in has a strict outbound host allowlist (most watch sites return 403 / "Host not in allowlist"). If you hit that, do NOT silently fall back to text — tell the user, and have them run `node .claude/skills/find-watch/shoot-watches.mjs` from a machine with open internet access. The script is self-contained and writes PNGs directly into `docs/watch-images/`, which can then be committed and reviewed.

Prereqs on a fresh machine:
```
npm i -g playwright
npx playwright install chromium
```

## Dashboard (`dashboard/`)

A static GitHub-Pages-deployable dashboard at `dashboard/` aggregates everything: Favorites, Brands, Sellers, Cities, Stores, Friends. Friend-group bookmarks + Reddit-style up/down votes via nickname-only "accounts" (no email, no password). LocalStorage by default; optional Pantry.cloud sync via `dashboard/config.js`.

When updating:

- **Add a watch** → push an entry into `dashboard/data.json` `favorites` array. Required: `id`, `brand`, `model`, `size_mm`, `strap`, `dial`, `url`, `status`, `fit`. Optional: `image` (path under `dashboard/images/`), `tags`, `price_*` fields, `note`.
- **Add a store** → push into `stores` array with `name`, `city`, `type`, `address`, `hours`, `brands` (array), `url`. Make sure the city already exists in `cities` (or add it).
- **Add a brand** → push into `brands` array. `tier` is 1/2/3 per the profile; `cities` lists where it has presence.
- **Add a seller** → push into `sellers` array. `type` is one of `marketplace | auction | dealer | data`.
- **Verify before commit** → `python3 -c "import json; json.load(open('dashboard/data.json'))"` to sanity check.
- **Local preview** → `cd dashboard && python3 -m http.server 8765` then open `http://localhost:8765/`.
- **Deploy** → push to a branch the Pages workflow watches (`main` or `claude/general-session-Jbawg`). Workflow at `.github/workflows/pages.yml` builds & publishes.

When the user asks "add X to the dashboard", edit `data.json` directly — don't generate a separate file or list.

When the user asks "what's on the dashboard?", read `data.json` and summarize counts per tab; don't re-scrape.

## Design philosophy (do not violate)

The dashboard's UI must match the same restraint Arman demands in his watches. When adding features:

- **Minimal filters.** One filter per tab maximum, ideally zero. Do not add multi-dropdown "filter bars". Use chips or a single search box if needed. Sorting > filtering.
- **Less copy.** Cards are short. No "Best for:" / "Fees:" labels — let the content speak. Cut header subtitles, redundant "Source:" lines, repeated hint text.
- **Restrained typography.** Cormorant Garamond (serif) for headings, Inter (sans) for body. No emoji decoration. No inline icons unless functional (★ ▲ ▼).
- **Warm palette only.** Cream `#f6f1e8` background, paper `#fffbf3` cards, ink `#1a1815` text, persimmon `#b85a2e` as the single accent. Do not add second/third accent colors.
- **Pills, not badges.** Small, square-ish, low-saturation. Status differentiation via color tone, not shape change.
- **Breathing room.** ≥24px gap between cards. ≥18-20px card padding. Underutilize, do not crowd.
- **Hierarchy, not decoration.** Bold headlines (serif), thin metadata (muted sans), single price line. No drop shadows on cards (use border-color hover instead).
- **No nested filtering.** Don't ship "show only my bookmarks" type pseudo-filters — surface those via a separate tab (Friends).
- **Don't pad cards** with empty sections. If a watch lacks `note` or `tags`, render the card without that block.
- **Sticky header tabs** only; no second sticky bar. Search lives in the tab bar.

If the user pushes back with "too many filters / words / variables", the answer is to remove, not rearrange.
