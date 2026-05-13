# PHIL-GUESSR

A HomeGuessr-style live-multiplayer game for Phil's bachelor party in Joshua Tree.
Instead of guessing where random US houses are, you guess where the places
from Phil's life are — and one number about each.

- **Host** opens the game on a TV/laptop → gets a QR code + 4-letter game code.
- **Up to 20 guests** scan the QR on their phones, type their name, and join.
- Each round shows a **place** from Phil's life (childhood home, NYU dorm,
  proposal spot, Diana in Melbourne, Joshua Tree itself, etc.) with a photo
  and metadata pills.
- Players do two things per round:
  1. **Drop a pin** on a world map for the location (up to 2,500 pts based on
     distance from truth)
  2. **Slide** to guess a number — rent, age, year, miles, whatever the round
     asks (up to 2,500 pts based on closeness)
- Combined out of 5,000 pts per round. Result screen shows a giant %, the
  truth on a map next to your guess, and a tier-based roast.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Open the host view in one tab, then visit `http://localhost:3000/play/<CODE>`
in another tab or your phone over LAN.

## Customize the places

All 8 starter places live in `lib/places.ts`. Most answers are placeholders —
**edit them before the party** so scoring is correct. For each place, set:

- `title` — display name ("Phil's childhood home")
- `pills` — small overlay tags on the photo (["San Diego, CA", "1996 – 2014"])
- `location` — `{ lat, lng, label }` — the truth
- `numericQuestion` — the slider question with `min`, `max`, `answer`, `unitPrefix` / `unitSuffix`
- `funFact` — shown on reveal
- `image` (optional) — path like `/photos/childhood-home.jpg`

Drop photos in `public/photos/` and reference them with `image:`.

## Deploy to Vercel

1. Push this branch to GitHub.
2. Connect / import the repo at [vercel.com/new](https://vercel.com/new).
3. Accept defaults. No env vars needed. Map tiles use OpenStreetMap (free).

### Caveat: in-memory state

Game state is stored in memory on the server. With a single warm Vercel
function instance, all 20 guests share state fine for an evening. If you
see "missing player" errors under load, swap `lib/store.ts` to Vercel KV
(Redis) — easy follow-up.

## Joshua Tree day-of checklist

- Bring a hotspot. Desert WiFi is unreliable.
- Test on the actual TV/projector the day before.
- Pre-warm the Vercel function: open the host page 30 seconds before guests start joining.
- If you add photos, keep each under ~300 KB.

## Scoring

- **Location**: 2,500 × exp(-distance_km / 2000). Within ~25 km feels like a
  bullseye, ~500 km still rewarding, antipodes get zero.
- **Number**: smooth curve from 2,500 pts (exact) to 0 pts (≥ 60% of the
  slider range off).

## Tech

- Next.js 14 (App Router) + TypeScript + Tailwind
- Leaflet + OpenStreetMap tiles for maps (no API key)
- React clients poll `/api/game/[code]/state` every 1.5 s
- In-memory game store (singleton via `globalThis`)
- `qrcode` for the join QR
- No external services / env vars required
