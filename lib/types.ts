export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  title: string;
  image?: string;
  pills?: string[];
  location: LatLng & { label: string };
  numericQuestion: {
    label: string;
    prompt: string;
    answer: number;
    unitPrefix?: string;
    unitSuffix?: string;
    min: number;
    max: number;
    step?: number;
  };
  funFact?: string;
}

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
  score: number;
  lastRoundPoints?: number;
}

export type Phase = "lobby" | "round" | "reveal" | "finished";

export interface RoundAnswer {
  playerId: string;
  guess: LatLng | null;
  number: number | null;
  submittedAt: number;
  locationPoints?: number;
  numberPoints?: number;
  totalPoints?: number;
  distanceKm?: number;
}

export interface Game {
  code: string;
  hostToken: string;
  createdAt: number;
  phase: Phase;
  players: Record<string, Player>;
  places: Place[];
  placeIndex: number;
  answers: Record<string, RoundAnswer>;
  roundStartedAt?: number;
  roundDurationMs: number;
}

export interface PublicPlace {
  id: string;
  title: string;
  image?: string;
  pills?: string[];
  numericQuestion: {
    label: string;
    prompt: string;
    unitPrefix?: string;
    unitSuffix?: string;
    min: number;
    max: number;
    step?: number;
  };
}

export interface PublicAnswerSummary {
  playerId: string;
  guess: LatLng | null;
  number: number | null;
  locationPoints: number;
  numberPoints: number;
  totalPoints: number;
  distanceKm: number;
}

export interface RevealView {
  placeId: string;
  location: LatLng & { label: string };
  numberAnswer: number;
  funFact?: string;
  perPlayer: PublicAnswerSummary[];
}

export interface PublicGameView {
  code: string;
  phase: Phase;
  players: Player[];
  placeIndex: number;
  totalPlaces: number;
  place?: PublicPlace;
  reveal?: RevealView;
  roundStartedAt?: number;
  roundDurationMs: number;
  answeredPlayerIds: string[];
}

export const MAX_LOCATION_POINTS = 2500;
export const MAX_NUMBER_POINTS = 2500;
export const MAX_ROUND_POINTS = MAX_LOCATION_POINTS + MAX_NUMBER_POINTS;
