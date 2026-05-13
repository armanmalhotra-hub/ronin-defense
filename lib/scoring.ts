import type { LatLng, Round, RoundAnswer } from "./types";
import {
  MAX_LOCATION_POINTS,
  MAX_NUMBER_POINTS,
  MAX_ROUND_POINTS,
} from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function locationScore(distanceKm: number, max = MAX_LOCATION_POINTS): number {
  const score = max * Math.exp(-distanceKm / 2000);
  return Math.max(0, Math.round(score));
}

export function numberScoreScaled(
  guess: number,
  truth: number,
  range: number,
  max: number,
): number {
  if (!Number.isFinite(guess)) return 0;
  const error = Math.abs(guess - truth);
  const normalized = error / Math.max(range, 1);
  if (normalized <= 0.002) return max;
  if (normalized >= 0.6) return 0;
  const score = max * Math.pow(1 - normalized / 0.6, 1.6);
  return Math.max(0, Math.round(score));
}

interface Scored {
  locationPoints: number;
  numberPoints: number;
  totalPoints: number;
  distanceKm: number;
}

export function scoreAnswer(round: Round, ans: RoundAnswer | undefined): Scored {
  const empty: Scored = {
    locationPoints: 0,
    numberPoints: 0,
    totalPoints: 0,
    distanceKm: 0,
  };
  if (!ans) return empty;

  switch (round.kind) {
    case "map_number": {
      const distanceKm =
        ans.guess != null
          ? haversineKm(ans.guess, round.location)
          : Infinity;
      const lp = ans.guess != null ? locationScore(distanceKm) : 0;
      const range = round.numericQuestion.max - round.numericQuestion.min;
      const np =
        typeof ans.number === "number"
          ? numberScoreScaled(
              ans.number,
              round.numericQuestion.answer,
              range,
              MAX_NUMBER_POINTS,
            )
          : 0;
      return {
        locationPoints: lp,
        numberPoints: np,
        totalPoints: lp + np,
        distanceKm: isFinite(distanceKm) ? distanceKm : 0,
      };
    }
    case "number": {
      const range = round.numericQuestion.max - round.numericQuestion.min;
      const np =
        typeof ans.number === "number"
          ? numberScoreScaled(
              ans.number,
              round.numericQuestion.answer,
              range,
              MAX_ROUND_POINTS,
            )
          : 0;
      return { ...empty, numberPoints: np, totalPoints: np };
    }
    case "multiple_choice":
    case "photo_choice": {
      const correct = ans.choiceIndex === round.answerIndex;
      return correct
        ? { ...empty, totalPoints: MAX_ROUND_POINTS }
        : empty;
    }
    case "higher_lower":
    case "yes_no": {
      const correct = ans.binaryValue === round.answer;
      return correct
        ? { ...empty, totalPoints: MAX_ROUND_POINTS }
        : empty;
    }
  }
}
