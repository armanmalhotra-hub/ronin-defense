import type {
  Game,
  PublicGameView,
  PublicQuestion,
  RevealView,
  Question,
} from "./types";

export function toPublicQuestion(q: Question): PublicQuestion {
  const base = {
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    image: q.image,
    caption: q.caption,
  };
  if (q.kind === "closest") {
    return { ...base, unit: q.unit, hint: q.hint };
  }
  if (q.kind === "higher_lower") {
    return {
      ...base,
      reference: q.reference,
      unit: q.unit,
      statement: q.statement,
    };
  }
  if (q.kind === "multiple_choice") {
    return { ...base, choices: q.choices };
  }
  return base;
}

export function toPublicView(game: Game): PublicGameView {
  const players = Object.values(game.players).sort((a, b) => b.score - a.score);
  const view: PublicGameView = {
    code: game.code,
    phase: game.phase,
    players,
    questionIndex: game.questionIndex,
    totalQuestions: game.questions.length,
    questionStartedAt: game.questionStartedAt,
    questionDurationMs: game.questionDurationMs,
    answeredPlayerIds: Object.keys(game.answers),
  };
  if (game.phase === "question" || game.phase === "reveal") {
    const q = game.questions[game.questionIndex];
    if (q) view.question = toPublicQuestion(q);
  }
  if (game.phase === "reveal") {
    const q = game.questions[game.questionIndex];
    if (q) view.reveal = buildReveal(game, q);
  }
  return view;
}

function buildReveal(game: Game, q: Question): RevealView {
  let answer: string | number;
  let unit: string | undefined;
  if (q.kind === "closest") {
    answer = q.answer;
    unit = q.unit;
  } else if (q.kind === "higher_lower") {
    answer = q.answer;
  } else if (q.kind === "yes_no") {
    answer = q.answer;
  } else {
    answer = q.choices[q.answerIndex];
  }
  return {
    questionId: q.id,
    answer,
    unit,
    funFact: q.funFact,
    perPlayer: Object.values(game.players).map((p) => {
      const ans = game.answers[p.id];
      return {
        playerId: p.id,
        value: ans ? ans.value : null,
        pointsEarned: ans?.pointsEarned ?? 0,
      };
    }),
  };
}
