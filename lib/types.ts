export type QuestionKind =
  | "closest"
  | "higher_lower"
  | "yes_no"
  | "multiple_choice";

interface BaseQuestion {
  id: string;
  prompt: string;
  image?: string;
  caption?: string;
  funFact?: string;
}

export interface ClosestQuestion extends BaseQuestion {
  kind: "closest";
  answer: number;
  unit?: string;
  hint?: string;
}

export interface HigherLowerQuestion extends BaseQuestion {
  kind: "higher_lower";
  reference: number;
  answer: "higher" | "lower";
  unit?: string;
  statement: string;
}

export interface YesNoQuestion extends BaseQuestion {
  kind: "yes_no";
  answer: "yes" | "no";
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  kind: "multiple_choice";
  choices: string[];
  answerIndex: number;
}

export type Question =
  | ClosestQuestion
  | HigherLowerQuestion
  | YesNoQuestion
  | MultipleChoiceQuestion;

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
  score: number;
  lastBonus?: number;
}

export type Phase =
  | "lobby"
  | "question"
  | "reveal"
  | "leaderboard"
  | "finished";

export interface RoundAnswer {
  playerId: string;
  value: string | number;
  submittedAt: number;
  pointsEarned?: number;
}

export interface Game {
  code: string;
  hostToken: string;
  createdAt: number;
  phase: Phase;
  players: Record<string, Player>;
  questions: Question[];
  questionIndex: number;
  answers: Record<string, RoundAnswer>;
  questionStartedAt?: number;
  questionDurationMs: number;
}

export interface PublicGameView {
  code: string;
  phase: Phase;
  players: Player[];
  questionIndex: number;
  totalQuestions: number;
  question?: PublicQuestion;
  reveal?: RevealView;
  questionStartedAt?: number;
  questionDurationMs: number;
  answeredPlayerIds: string[];
}

export interface PublicQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  image?: string;
  caption?: string;
  unit?: string;
  hint?: string;
  reference?: number;
  statement?: string;
  choices?: string[];
}

export interface RevealView {
  questionId: string;
  answer: string | number;
  unit?: string;
  funFact?: string;
  perPlayer: Array<{
    playerId: string;
    value: string | number | null;
    pointsEarned: number;
  }>;
}
