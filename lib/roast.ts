// Roast tiers triggered by points earned this round (out of 1000).
// Tone: HomeGuessr-style witty deadpan, slightly meaner because bachelor party.

const PERFECT = [
  "You know Phil better than Michelle does. Concerning.",
  "Genuinely scary. Are you tracking him?",
  "Bullseye. You've earned the right to give a speech.",
];

const GREAT = [
  "Solid. Phil's lawyer would call you a credible witness.",
  "Nailed it. Phil is sweating somewhere.",
  "Your Phil intel is elite. Use it responsibly.",
];

const OK = [
  "Close. You've been around, but not in the group chat.",
  "You're a casual Phil enjoyer. That's okay.",
  "Solid effort. Vibes-based, but solid.",
];

const BAD = [
  "Did you even meet Phil?",
  "That guess is a cry for help.",
  "You and Phil are technically acquaintances at this point.",
];

const ZERO = [
  "Catastrophic. Was this your first time hearing his name?",
  "Phil saw your guess and unfollowed you.",
  "You should not be at this bachelor party.",
  "RSVP yes, brain no.",
];

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export function roast(points: number, seed: string): string {
  if (points >= 950) return pick(PERFECT, seed);
  if (points >= 700) return pick(GREAT, seed);
  if (points >= 400) return pick(OK, seed);
  if (points > 0) return pick(BAD, seed);
  return pick(ZERO, seed);
}
