import type { LatLng, Place } from "./types";
import { MAX_LOCATION_POINTS, MAX_NUMBER_POINTS } from "./types";

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

// HomeGuessr-style exponential decay. Within ~25 km feels like "hit it",
// within ~500 km still feels rewarding, antipode (~20000 km) is zero.
export function locationScore(distanceKm: number): number {
  const score = MAX_LOCATION_POINTS * Math.exp(-distanceKm / 2000);
  return Math.max(0, Math.round(score));
}

export function numberScore(guess: number, truth: number, range: number): number {
  if (!Number.isFinite(guess)) return 0;
  const error = Math.abs(guess - truth);
  const normalized = error / Math.max(range, 1);
  if (normalized <= 0.002) return MAX_NUMBER_POINTS;
  if (normalized >= 0.6) return 0;
  // Smooth curve: 0 error -> full, 0.6 of range -> 0
  const score = MAX_NUMBER_POINTS * Math.pow(1 - normalized / 0.6, 1.6);
  return Math.max(0, Math.round(score));
}

export function scoreAnswer(
  place: Place,
  guess: LatLng | null,
  number: number | null,
): {
  locationPoints: number;
  numberPoints: number;
  totalPoints: number;
  distanceKm: number;
} {
  const distanceKm = guess ? haversineKm(guess, place.location) : Infinity;
  const lp = guess ? locationScore(distanceKm) : 0;
  const range = place.numericQuestion.max - place.numericQuestion.min;
  const np =
    typeof number === "number"
      ? numberScore(number, place.numericQuestion.answer, range)
      : 0;
  return {
    locationPoints: lp,
    numberPoints: np,
    totalPoints: lp + np,
    distanceKm: isFinite(distanceKm) ? distanceKm : 0,
  };
}
