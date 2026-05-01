# How Well Do You Know Phil?

A live-multiplayer guessing game for Phil's bachelor party in Joshua Tree.
Inspired by [HomeGuessr](https://homeguessr.com/) — but instead of houses,
you're guessing stuff about the groom.

- **Host** opens the game on a TV/laptop and gets a QR code + 4-letter game code.
- **Up to 20 guests** scan the QR on their phones, type their name, and join.
- Each round is a question about Phil with one of four answer types:
  - **Closest wins** (numeric guess, partial credit by closeness)
  - **Higher / lower** (vs. a stated reference number)
  - **Yes / no** (betting)
  - **Multiple choice** (pick A/B/C/D, photos optional)
- After each round the host reveals the answer, points get awarded, and the
  live leaderboard updates on every screen.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Open the host view in one tab, then open `http://localhost:3000/play/<CODE>` in
several other tabs (or on your phone over LAN) to simulate guests.

## Customize the questions

All 15 starter questions live in `lib/questions.ts`. Most of the answers are
placeholders — **edit them before the party** so the scoring is correct.

Each question can include an optional `image` field. Drop photos in
`public/photos/` and reference them like `/photos/baby-phil.jpg`.

Question types and the fields each one needs:

```ts
{ kind: "closest", prompt, answer: 42, unit?: "miles", hint? }
{ kind: "higher_lower", prompt, statement, reference: 3500, unit?, answer: "higher" | "lower" }
{ kind: "yes_no", prompt, answer: "yes" | "no" }
{ kind: "multiple_choice", prompt, choices: [...], answerIndex: 0 }
```

Optional on any question: `image`, `caption`, `funFact` (shown on reveal).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, accept the
   defaults. No environment variables needed.
3. Share the resulting URL (e.g. `phils-party.vercel.app`) with the host
   device on the day.

### Important caveat: in-memory state

Game state lives in memory on the server. On Vercel that means **all 20 guests
must hit the same serverless instance** for the duration of the party. With
free-tier traffic levels this almost always works, because the function stays
warm on a single instance. If you see weird "missing player" errors, that's the
signal that Vercel cold-started a new instance — the fix is to upgrade `lib/store.ts`
to use [Vercel KV](https://vercel.com/docs/storage/vercel-kv) or Upstash Redis.
Easy swap if you need it.

## Joshua Tree day-of checklist

- **Bring a hotspot.** The desert WiFi situation is unreliable. Tether the host
  laptop and the guests' phones to one strong cell signal.
- **Test on the actual hardware** the day before. Open the host page on the
  TV/projector you'll use, scan the QR with two phones, and play a few rounds.
- **Have a backup plan.** If networking dies entirely, pre-print the questions
  on paper and run it pub-quiz style.
- **Pre-load images.** If you add photos in `public/photos/`, make sure they're
  reasonably small (~300 KB each) so they load fast on cell.

## How a round works

1. Host clicks **Start the game**.
2. Question appears on the host screen and on every player's phone.
3. Players tap their answer / type a number and lock it in. The host screen
   shows `X of Y answered` so you know when to move on.
4. Host clicks **Reveal answer** — the answer appears on every screen with the
   fun fact, and points are added to the leaderboard.
5. Host clicks **Next question**. Repeat for 15 rounds.
6. After the last reveal, host clicks **Show final results** for the champion
   screen.

## Scoring

- Yes/no, higher/lower, multiple choice: **1000 points** for a correct answer,
  0 otherwise.
- Closest wins: scaled from 0 to 1000 based on relative error vs. the truth.
  A guess within 0.1% gets the full 1000; anything off by 100% or more gets 0.

## Tech

- Next.js 14 (App Router) + TypeScript + Tailwind
- React client polls `/api/game/[code]/state` every ~1.5 s
- In-memory game store (singleton via `globalThis`)
- `qrcode` for the join QR
- No external services required
