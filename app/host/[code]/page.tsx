"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { QrCode } from "@/components/QrCode";
import { Leaderboard } from "@/components/Leaderboard";
import type { PublicGameView } from "@/lib/types";

export default function HostPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const { data, error } = usePoll<PublicGameView>(
    `/api/game/${code}/state`,
    1200,
  );

  useEffect(() => {
    setHostToken(sessionStorage.getItem(`host:${code}`));
    setOrigin(window.location.origin);
  }, [code]);

  const joinUrl = origin ? `${origin}/play/${code}` : "";

  async function start() {
    if (!hostToken) return;
    await fetch(`/api/game/${code}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
  }

  async function advance() {
    if (!hostToken) return;
    await fetch(`/api/game/${code}/advance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
  }

  if (error && !data) {
    return <Centered>Couldn't reach the server. {error}</Centered>;
  }
  if (!data) {
    return <Centered>Loading lobby…</Centered>;
  }

  if (data.phase === "lobby") {
    return (
      <main className="min-h-screen p-6 sm:p-10 flex flex-col items-center">
        <div className="max-w-5xl w-full grid sm:grid-cols-2 gap-8">
          <div className="card flex flex-col items-center text-center gap-4">
            <p className="label">Scan to join</p>
            {joinUrl && <QrCode value={joinUrl} size={260} />}
            <div>
              <p className="text-white/60 text-sm">Or visit</p>
              <p className="font-mono text-sand">{joinUrl}</p>
            </div>
            <div className="mt-4">
              <p className="label">Game code</p>
              <p className="font-display text-7xl tracking-widest text-sunset">
                {code}
              </p>
            </div>
          </div>

          <div className="card flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-display text-sand">Players</h2>
              <span className="text-white/50">
                {data.players.length} joined
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <Leaderboard players={data.players} />
            </div>
            <button
              className="btn-primary text-lg"
              onClick={start}
              disabled={data.players.length === 0 || !hostToken}
            >
              Start the game →
            </button>
            {!hostToken && (
              <p className="text-xs text-red-300">
                Host token missing. You may have refreshed the host tab. Create
                a new game from the homepage.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (data.phase === "finished") {
    const winner = data.players[0];
    return (
      <main className="min-h-screen p-6 sm:p-10 flex flex-col items-center">
        <div className="max-w-3xl w-full card text-center space-y-6">
          <p className="label">Final standings</p>
          <h1 className="text-5xl font-display text-sand">🏆 Champion 🏆</h1>
          <p className="text-3xl text-sunset font-display">
            {winner?.name ?? "—"}
          </p>
          <p className="text-white/60">
            with {winner?.score.toLocaleString() ?? 0} points
          </p>
          <Leaderboard players={data.players} />
        </div>
      </main>
    );
  }

  // question or reveal
  return (
    <main className="min-h-screen p-6 sm:p-10 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card flex flex-col gap-6">
        <HostQuestionPanel data={data} />
      </div>
      <div className="card flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-display text-sand">Leaderboard</h2>
          <span className="text-white/50 text-sm">
            Round {data.questionIndex + 1} / {data.totalQuestions}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <Leaderboard players={data.players} showBonus={data.phase === "reveal"} />
        </div>
        <button
          className="btn-primary text-lg"
          onClick={advance}
          disabled={!hostToken}
        >
          {data.phase === "question"
            ? "Reveal answer →"
            : data.questionIndex + 1 >= data.totalQuestions
            ? "Show final results →"
            : "Next question →"}
        </button>
      </div>
    </main>
  );
}

function HostQuestionPanel({ data }: { data: PublicGameView }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const remaining = useMemo(() => {
    if (data.phase !== "question" || !data.questionStartedAt) return null;
    const ms = data.questionStartedAt + data.questionDurationMs - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data, now]);

  const q = data.question;
  const reveal = data.reveal;
  if (!q) return null;
  const answeredCount = data.answeredPlayerIds.length;
  const totalPlayers = data.players.length;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-baseline justify-between">
        <p className="label">
          Question {data.questionIndex + 1} of {data.totalQuestions}
        </p>
        {remaining !== null && (
          <p className="font-display text-3xl text-sunset tabular-nums">
            {remaining}s
          </p>
        )}
      </div>

      <h2 className="text-3xl sm:text-4xl font-display text-sand leading-tight">
        {q.prompt}
      </h2>

      {q.image && (
        <img
          src={q.image}
          alt=""
          className="rounded-2xl max-h-96 object-cover"
        />
      )}

      {q.kind === "higher_lower" && (
        <p className="text-2xl text-white/80">{q.statement}</p>
      )}

      {q.kind === "multiple_choice" && q.choices && (
        <ul className="grid sm:grid-cols-2 gap-3">
          {q.choices.map((c, i) => (
            <li
              key={i}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3"
            >
              <span className="text-white/40 mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {c}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between text-white/60">
        <p>
          Answered:{" "}
          <span className="text-sand font-semibold">
            {answeredCount} / {totalPlayers}
          </span>
        </p>
      </div>

      {data.phase === "reveal" && reveal && (
        <div className="rounded-2xl bg-sunset/15 border border-sunset/40 p-5 space-y-2">
          <p className="label">Answer</p>
          <p className="text-3xl font-display text-sunset">
            {String(reveal.answer)}
            {reveal.unit ? ` ${reveal.unit}` : ""}
          </p>
          {reveal.funFact && (
            <p className="text-white/70 italic">{reveal.funFact}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-white/70">
      {children}
    </main>
  );
}
