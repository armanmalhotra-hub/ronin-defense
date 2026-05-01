---
name: find-watch
description: Find watches matching Arman's preference profile (Japanese independents, 34-37mm, leather/rubber, no chronograph, warm tones). Use when the user asks to find/recommend/scout watches, check drop windows, monitor secondary-market prices, or evaluate a specific watch against their taste. Examples - "find me a watch", "any new Kurono drops?", "is the [X] a fit?", "what should I bid on?".
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
