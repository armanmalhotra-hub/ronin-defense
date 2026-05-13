export interface LatLng {
  lat: number;
  lng: number;
}

export interface NumericConfig {
  label: string;
  prompt: string;
  answer: number;
  unitPrefix?: string;
  unitSuffix?: string;
  min: number;
  max: number;
  step?: number;
}

interface BaseRound {
  id: string;
  title: string;
  image?: string;
  pills?: string[];
  funFact?: string;
}

export interface MapNumberRound extends BaseRound {
  kind: "map_number";
  location: LatLng & { label: string };
  numericQuestion: NumericConfig;
}

export interface NumberRound extends BaseRound {
  kind: "number";
  numericQuestion: NumericConfig;
}

export interface MultipleChoiceRound extends BaseRound {
  kind: "multiple_choice";
  prompt: string;
  choices: string[];
  answerIndex: number;
}

export interface PhotoChoiceRound extends BaseRound {
  kind: "photo_choice";
  prompt: string;
  choices: Array<{ image: string; label?: string }>;
  answerIndex: number;
}

export interface HigherLowerRound extends BaseRound {
  kind: "higher_lower";
  prompt: string;
  statement: string;
  reference: number;
  unitPrefix?: string;
  unitSuffix?: string;
  answer: "higher" | "lower";
}

export interface YesNoRound extends BaseRound {
  kind: "yes_no";
  prompt: string;
  answer: "yes" | "no";
}

export type Round =
  | MapNumberRound
  | NumberRound
  | MultipleChoiceRound
  | PhotoChoiceRound
  | HigherLowerRound
  | YesNoRound;

export type RoundKind = Round["kind"];

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
  guess?: LatLng | null;
  number?: number | null;
  choiceIndex?: number | null;
  binaryValue?: string | null;
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
  rounds: Round[];
  roundIndex: number;
  answers: Record<string, RoundAnswer>;
  roundStartedAt?: number;
  roundDurationMs: number;
}

export interface PublicRoundBase {
  id: string;
  kind: RoundKind;
  title: string;
  image?: string;
  pills?: string[];
}

export type PublicRound =
  | (PublicRoundBase & {
      kind: "map_number";
      numericQuestion: Omit<NumericConfig, "answer">;
    })
  | (PublicRoundBase & {
      kind: "number";
      numericQuestion: Omit<NumericConfig, "answer">;
    })
  | (PublicRoundBase & {
      kind: "multiple_choice";
      prompt: string;
      choices: string[];
    })
  | (PublicRoundBase & {
      kind: "photo_choice";
      prompt: string;
      choices: Array<{ image: string; label?: string }>;
    })
  | (PublicRoundBase & {
      kind: "higher_lower";
      prompt: string;
      statement: string;
      reference: number;
      unitPrefix?: string;
      unitSuffix?: string;
    })
  | (PublicRoundBase & {
      kind: "yes_no";
      prompt: string;
    });

export interface PublicAnswerSummary {
  playerId: string;
  guess?: LatLng | null;
  number?: number | null;
  choiceIndex?: number | null;
  binaryValue?: string | null;
  locationPoints: number;
  numberPoints: number;
  totalPoints: number;
  distanceKm: number;
}

export interface RevealView {
  roundId: string;
  kind: RoundKind;
  location?: LatLng & { label: string };
  numberAnswer?: number;
  choiceIndex?: number;
  binaryAnswer?: string;
  funFact?: string;
  perPlayer: PublicAnswerSummary[];
}

export interface PublicGameView {
  code: string;
  phase: Phase;
  players: Player[];
  roundIndex: number;
  totalRounds: number;
  round?: PublicRound;
  reveal?: RevealView;
  roundStartedAt?: number;
  roundDurationMs: number;
  answeredPlayerIds: string[];
}

export const MAX_ROUND_POINTS = 5000;
export const MAX_LOCATION_POINTS = 2500;
export const MAX_NUMBER_POINTS = 2500;
