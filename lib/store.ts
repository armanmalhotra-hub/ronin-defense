import { randomBytes } from "crypto";
import type { Game, Player, RoundAnswer, Phase, LatLng } from "./types";
import { PHIL_PLACES } from "./places";
import { scoreAnswer } from "./scoring";

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

export function createGame(durationSeconds = 45): Game {
  const store = games();
  let code = makeCode();
  while (store.has(code)) code = makeCode();
  const game: Game = {
    code,
    hostToken: token(),
    createdAt: Date.now(),
    phase: "lobby",
    players: {},
    places: [...PHIL_PLACES],
    placeIndex: 0,
    answers: {},
    roundDurationMs: durationSeconds * 1000,
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
  game.phase = "round";
  game.placeIndex = 0;
  game.answers = {};
  game.roundStartedAt = Date.now();
  return game;
}

export function submitAnswer(
  code: string,
  playerId: string,
  guess: LatLng | null,
  number: number | null,
): boolean {
  const game = getGame(code);
  if (!game) return false;
  if (game.phase !== "round") return false;
  if (!game.players[playerId]) return false;
  if (game.answers[playerId]) return false;
  const answer: RoundAnswer = {
    playerId,
    guess,
    number,
    submittedAt: Date.now(),
  };
  game.answers[playerId] = answer;
  return true;
}

export function reveal(code: string, hostToken: string): Game | null {
  const game = getGame(code);
  if (!game || game.hostToken !== hostToken) return null;
  if (game.phase !== "round") return null;
  const place = game.places[game.placeIndex];
  if (!place) return null;
  for (const playerId of Object.keys(game.players)) {
    const ans = game.answers[playerId];
    if (!ans) {
      game.players[playerId].lastRoundPoints = 0;
      continue;
    }
    const scored = scoreAnswer(place, ans.guess, ans.number);
    ans.locationPoints = scored.locationPoints;
    ans.numberPoints = scored.numberPoints;
    ans.totalPoints = scored.totalPoints;
    ans.distanceKm = scored.distanceKm;
    game.players[playerId].score += scored.totalPoints;
    game.players[playerId].lastRoundPoints = scored.totalPoints;
  }
  game.phase = "reveal";
  return game;
}

export function advance(code: string, hostToken: string): Game | null {
  const game = getGame(code);
  if (!game || game.hostToken !== hostToken) return null;
  const lastIndex = game.places.length - 1;
  if (game.phase === "reveal") {
    if (game.placeIndex >= lastIndex) {
      game.phase = "finished";
      return game;
    }
    game.placeIndex += 1;
    game.answers = {};
    game.phase = "round";
    game.roundStartedAt = Date.now();
    return game;
  }
  if (game.phase === "round") {
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
