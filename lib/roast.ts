// Roast tiers tuned to HomeGuessr's "Your pricing is elite. Your geography
// is in witness protection." energy.

const BOTH_GREAT = [
  "Surgical. You know Phil better than Michelle does. Concerning.",
  "You're a Phil scholar. Submit your dissertation.",
  "Both axes nailed. This is your real personality.",
];

const LOC_GOOD_NUM_BAD = [
  "Your geography is elite. Your numeracy is in witness protection.",
  "You can find Phil on a map. You cannot find his bank account.",
  "Pin: tight. Math: not your ministry.",
];

const NUM_GOOD_LOC_BAD = [
  "Your numbers are elite. Your geography is in witness protection.",
  "You know Phil's rent. You do not know which country he's in.",
  "Numbers solid. Map skills: child of the internet.",
];

const MID = [
  "Vibes-based, but not embarrassing.",
  "You're a casual Phil enjoyer. That's okay.",
  "Adequate. Phil would describe you as a \"good acquaintance\".",
];

const BAD = [
  "Did you even meet Phil?",
  "You and Phil are technically strangers at this point.",
  "Both axes catastrophic. RSVP yes, brain no.",
  "Phil saw your guess and unfollowed you.",
];

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export function roast(
  locationPct: number,
  numberPct: number,
  seed: string,
): string {
  const locGood = locationPct >= 0.65;
  const numGood = numberPct >= 0.65;
  const both = locGood && numGood;
  const bothBad = locationPct < 0.2 && numberPct < 0.2;
  if (both) return pick(BOTH_GREAT, seed);
  if (locGood && !numGood) return pick(LOC_GOOD_NUM_BAD, seed);
  if (numGood && !locGood) return pick(NUM_GOOD_LOC_BAD, seed);
  if (bothBad) return pick(BAD, seed);
  return pick(MID, seed);
}
