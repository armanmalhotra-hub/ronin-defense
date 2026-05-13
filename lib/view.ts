import type {
  Game,
  Place,
  PublicGameView,
  PublicPlace,
  RevealView,
} from "./types";

export function toPublicPlace(p: Place): PublicPlace {
  return {
    id: p.id,
    title: p.title,
    image: p.image,
    pills: p.pills,
    numericQuestion: {
      label: p.numericQuestion.label,
      prompt: p.numericQuestion.prompt,
      unitPrefix: p.numericQuestion.unitPrefix,
      unitSuffix: p.numericQuestion.unitSuffix,
      min: p.numericQuestion.min,
      max: p.numericQuestion.max,
      step: p.numericQuestion.step,
    },
  };
}

export function toPublicView(game: Game): PublicGameView {
  const players = Object.values(game.players).sort((a, b) => b.score - a.score);
  const view: PublicGameView = {
    code: game.code,
    phase: game.phase,
    players,
    placeIndex: game.placeIndex,
    totalPlaces: game.places.length,
    roundStartedAt: game.roundStartedAt,
    roundDurationMs: game.roundDurationMs,
    answeredPlayerIds: Object.keys(game.answers),
  };
  if (game.phase === "round" || game.phase === "reveal") {
    const p = game.places[game.placeIndex];
    if (p) view.place = toPublicPlace(p);
  }
  if (game.phase === "reveal") {
    const p = game.places[game.placeIndex];
    if (p) view.reveal = buildReveal(game, p);
  }
  return view;
}

function buildReveal(game: Game, p: Place): RevealView {
  return {
    placeId: p.id,
    location: p.location,
    numberAnswer: p.numericQuestion.answer,
    funFact: p.funFact,
    perPlayer: Object.values(game.players).map((player) => {
      const ans = game.answers[player.id];
      return {
        playerId: player.id,
        guess: ans?.guess ?? null,
        number: ans?.number ?? null,
        locationPoints: ans?.locationPoints ?? 0,
        numberPoints: ans?.numberPoints ?? 0,
        totalPoints: ans?.totalPoints ?? 0,
        distanceKm: ans?.distanceKm ?? 0,
      };
    }),
  };
}
