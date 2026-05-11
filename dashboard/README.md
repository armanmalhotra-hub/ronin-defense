# Watch Watch — friend-group dashboard

A static, no-account, no-email reference guide for Japanese independent watches. Built for Arman + friends to share favorites, vote on pieces, and plan the Tokyo trip.

## What's in it

Five tabs:

- **Favorites** — curated list of watches that fit the profile (Japanese independent, 34-37mm, no chrono, leather/rubber strap, warm/muted tones). Each card has fit score, status, price, and link.
- **Brands** — Tier 1/2/3 directory of Japanese independent watchmakers with style, price range, and stockist links.
- **Sellers** — secondary-market sources (Chrono24, Bezel, Wristcheck, LoupeThis, Phillips, A Collected Man, etc.) with what each is best for and fee structure.
- **Cities** — Tokyo, Kobe, Kyoto, Osaka, HK, NY, London — each card lists every store catalogued there.
- **Stores** — physical shops/ateliers/auction houses. Address, hours, brands carried, "Map it" link.
- **Friends** — leaderboard of who has bookmarked what. Useful for gift selection.

## Identity

No accounts, no email, no password. Just type a nickname in the top bar and click **Set**. That nickname owns your bookmarks and votes for that browser. Reuse it across devices to be recognized as the same person.

## Bookmarks & votes

- ★ Bookmark anything (watch, brand, seller, city, store). Your bookmarks show up under your name in the **Friends** tab.
- ▲ / ▼ Reddit-style upvote or downvote any item. Score = upvotes minus downvotes. Multiple people can like the same watch — score reflects group sentiment.

## Sync mode

By default, bookmarks/votes save to **localStorage** — same browser, same device only.

To sync **across all friends with no accounts**:

1. Visit https://getpantry.cloud/ and request a Pantry ID. Pantry is a free no-login JSON keystore.
2. Open `dashboard/config.js`. Paste your Pantry ID:
   ```js
   PANTRY_ID: "abcd-1234-...",
   ```
3. Commit and push. Anyone visiting the dashboard now reads/writes a single shared basket. The Pantry ID is the clubhouse passcode — share with friends only.

You can have separate friend groups by changing the `BASKET` name in `config.js`.

## Where the data comes from

`dashboard/data.json` is hand-curated from English-language watch publications (Monochrome Watches, Worn & Wound, Tokyo Weekender, SF Watchlover, Phillips), brand sites (Kurono, Naoya Hida), and auction-house catalogs. See the SKILL.md and the chat log for sourcing details.

To add a watch, brand, store, etc., edit `data.json` and push. The dashboard re-reads it on every load.

## Deploy on GitHub Pages

The `.github/workflows/pages.yml` action publishes the `dashboard/` folder automatically on every push to `main` (or whichever branch you point it at).

To enable:

1. In the repo settings → **Pages** → set **Source** to "GitHub Actions".
2. Push to the configured branch.
3. The dashboard will be live at `https://<user>.github.io/ronin-defense/`.

## Adding live screenshots

The skill ships with `screenshot.mjs` and `shoot-watches.mjs` for capturing real photos via headless Chromium (the Claude sandbox blocks the brand sites, so it's a local-run tool). Run from a normal machine with internet:

```sh
npm i -g playwright
npx playwright install chromium
node .claude/skills/find-watch/shoot-watches.mjs
```

Output drops into `docs/watch-images/`. Reference them in `data.json` via `"image": "../docs/watch-images/<id>.png"`.
