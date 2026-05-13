import type {
  Game,
  PublicGameView,
  PublicRound,
  RevealView,
  Round,
} from "./types";

export function toPublicRound(r: Round): PublicRound {
  const base = {
    id: r.id,
    title: r.title,
    image: r.image,
    pills: r.pills,
  };
  switch (r.kind) {
    case "map_number":
      return {
        ...base,
        kind: "map_number",
        numericQuestion: {
          label: r.numericQuestion.label,
          prompt: r.numericQuestion.prompt,
          unitPrefix: r.numericQuestion.unitPrefix,
          unitSuffix: r.numericQuestion.unitSuffix,
          min: r.numericQuestion.min,
          max: r.numericQuestion.max,
          step: r.numericQuestion.step,
        },
      };
    case "number":
      return {
        ...base,
        kind: "number",
        numericQuestion: {
          label: r.numericQuestion.label,
          prompt: r.numericQuestion.prompt,
          unitPrefix: r.numericQuestion.unitPrefix,
          unitSuffix: r.numericQuestion.unitSuffix,
          min: r.numericQuestion.min,
          max: r.numericQuestion.max,
          step: r.numericQuestion.step,
        },
      };
    case "multiple_choice":
      return { ...base, kind: "multiple_choice", prompt: r.prompt, choices: r.choices };
    case "photo_choice":
      return { ...base, kind: "photo_choice", prompt: r.prompt, choices: r.choices };
    case "higher_lower":
      return {
        ...base,
        kind: "higher_lower",
        prompt: r.prompt,
        statement: r.statement,
        reference: r.reference,
        unitPrefix: r.unitPrefix,
        unitSuffix: r.unitSuffix,
      };
    case "yes_no":
      return { ...base, kind: "yes_no", prompt: r.prompt };
  }
}

export function toPublicView(game: Game): PublicGameView {
  const players = Object.values(game.players).sort((a, b) => b.score - a.score);
  const view: PublicGameView = {
    code: game.code,
    phase: game.phase,
    players,
    roundIndex: game.roundIndex,
    totalRounds: game.rounds.length,
    roundStartedAt: game.roundStartedAt,
    roundDurationMs: game.roundDurationMs,
    answeredPlayerIds: Object.keys(game.answers),
  };
  if (game.phase === "round" || game.phase === "reveal") {
    const r = game.rounds[game.roundIndex];
    if (r) view.round = toPublicRound(r);
  }
  if (game.phase === "reveal") {
    const r = game.rounds[game.roundIndex];
    if (r) view.reveal = buildReveal(game, r);
  }
  return view;
}

function buildReveal(game: Game, r: Round): RevealView {
  const perPlayer = Object.values(game.players).map((p) => {
    const ans = game.answers[p.id];
    return {
      playerId: p.id,
      guess: ans?.guess ?? null,
      number: ans?.number ?? null,
      choiceIndex: ans?.choiceIndex ?? null,
      binaryValue: ans?.binaryValue ?? null,
      locationPoints: ans?.locationPoints ?? 0,
      numberPoints: ans?.numberPoints ?? 0,
      totalPoints: ans?.totalPoints ?? 0,
      distanceKm: ans?.distanceKm ?? 0,
    };
  });
  switch (r.kind) {
    case "map_number":
      return {
        roundId: r.id,
        kind: r.kind,
        location: r.location,
        numberAnswer: r.numericQuestion.answer,
        funFact: r.funFact,
        perPlayer,
      };
    case "number":
      return {
        roundId: r.id,
        kind: r.kind,
        numberAnswer: r.numericQuestion.answer,
        funFact: r.funFact,
        perPlayer,
      };
    case "multiple_choice":
    case "photo_choice":
      return {
        roundId: r.id,
        kind: r.kind,
        choiceIndex: r.answerIndex,
        funFact: r.funFact,
        perPlayer,
      };
    case "higher_lower":
    case "yes_no":
      return {
        roundId: r.id,
        kind: r.kind,
        binaryAnswer: r.answer,
        funFact: r.funFact,
        perPlayer,
      };
  }
}
