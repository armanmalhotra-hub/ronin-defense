import { randomBytes } from "crypto";
import type { Game, Player, Question, RoundAnswer, Phase } from "./types";
import { PHIL_QUESTIONS } from "./questions";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return out;
}

function token(): string {
  return randomBytes(16).toString("hex");
}

type Globals = typeof globalThis & {
  __PHIL_GAMES__?: Map<string, Game>;
};

function games(): Map<string, Game> {
  const g = globalThis as Globals;
  if (!g.__PHIL_GAMES__) g.__PHIL_GAMES__ = new Map();
  return g.__PHIL_GAMES__;
}

export function createGame(durationSeconds = 30): Game {
  const store = games();
  let code = makeCode();
  while (store.has(code)) code = makeCode();
  const game: Game = {
    code,
    hostToken: token(),
    createdAt: Date.now(),
    phase: "lobby",
    players: {},
    questions: [...PHIL_QUESTIONS],
    questionIndex: 0,
    answers: {},
    questionDurationMs: durationSeconds * 1000,
  };
  store.set(code, game);
  return game;
}

export function getGame(code: string): Game | undefined {
  return games().get(code.toUpperCase());
}

export function joinGame(code: string, name: string): Player | null {
  const game = getGame(code);
  if (!game) return null;
  if (game.phase !== "lobby") return null;
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) return null;
  const id = token();
  const player: Player = {
    id,
    name: trimmed,
    joinedAt: Date.now(),
    score: 0,
  };
  game.players[id] = player;
  return player;
}

export function startGame(code: string, hostToken: string): Game | null {
  const game = getGame(code);
  if (!game) return null;
  if (game.hostToken !== hostToken) return null;
  if (Object.keys(game.players).length === 0) return null;
  game.phase = "question";
  game.questionIndex = 0;
  game.answers = {};
  game.questionStartedAt = Date.now();
  return game;
}

export function submitAnswer(
  code: string,
  playerId: string,
  value: string | number,
): boolean {
  const game = getGame(code);
  if (!game) return false;
  if (game.phase !== "question") return false;
  if (!game.players[playerId]) return false;
  if (game.answers[playerId]) return false;
  const answer: RoundAnswer = {
    playerId,
    value,
    submittedAt: Date.now(),
  };
  game.answers[playerId] = answer;
  return true;
}

export function reveal(code: string, hostToken: string): Game | null {
  const game = getGame(code);
  if (!game || game.hostToken !== hostToken) return null;
  if (game.phase !== "question") return null;
  const q = game.questions[game.questionIndex];
  if (!q) return null;
  for (const playerId of Object.keys(game.players)) {
    const ans = game.answers[playerId];
    const points = computePoints(q, ans);
    game.players[playerId].score += points;
    game.players[playerId].lastBonus = points;
    if (ans) ans.pointsEarned = points;
  }
  game.phase = "reveal";
  return game;
}

export function advance(code: string, hostToken: string): Game | null {
  const game = getGame(code);
  if (!game || game.hostToken !== hostToken) return null;
  const lastIndex = game.questions.length - 1;
  if (game.phase === "reveal") {
    if (game.questionIndex >= lastIndex) {
      game.phase = "finished";
      return game;
    }
    game.questionIndex += 1;
    game.answers = {};
    game.phase = "question";
    game.questionStartedAt = Date.now();
    return game;
  }
  if (game.phase === "question") {
    return reveal(code, hostToken);
  }
  return game;
}

export function setPhase(code: string, hostToken: string, phase: Phase): Game | null {
  const game = getGame(code);
  if (!game || game.hostToken !== hostToken) return null;
  game.phase = phase;
  return game;
}

function computePoints(q: Question, ans?: RoundAnswer): number {
  if (!ans) return 0;
  if (q.kind === "yes_no") {
    return ans.value === q.answer ? 1000 : 0;
  }
  if (q.kind === "higher_lower") {
    return ans.value === q.answer ? 1000 : 0;
  }
  if (q.kind === "multiple_choice") {
    return Number(ans.value) === q.answerIndex ? 1000 : 0;
  }
  // closest: scaled by relative error
  const guess = Number(ans.value);
  if (Number.isNaN(guess)) return 0;
  const truth = q.answer;
  const denom = Math.max(Math.abs(truth), 1);
  const error = Math.abs(guess - truth) / denom;
  if (error <= 0.001) return 1000;
  if (error >= 1) return 0;
  return Math.round(1000 * (1 - error));
}
