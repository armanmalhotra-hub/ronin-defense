"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { Leaderboard } from "@/components/Leaderboard";
import { RoundDots } from "@/components/RoundDots";
import { roast } from "@/lib/roast";
import type { PublicGameView, PublicQuestion } from "@/lib/types";

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`player:${code}`);
    if (stored) setPlayerId(stored);
  }, [code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/game/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not join");
      sessionStorage.setItem(`player:${code}`, json.playerId);
      sessionStorage.setItem(`playerName:${code}`, json.name);
      setPlayerId(json.playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setJoining(false);
    }
  }

  if (!playerId) {
    return (
      <main className="min-h-[100dvh] p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full card space-y-5">
          <div className="text-center">
            <p className="label">Joining game</p>
            <p className="font-display text-5xl text-sunset tracking-widest">
              {code}
            </p>
          </div>
          <form onSubmit={join} className="space-y-4">
            <label className="label block">Your name</label>
            <input
              className="input"
              autoFocus
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aron"
              required
            />
            <button
              className="btn-primary w-full"
              disabled={joining || !name.trim()}
            >
              {joining ? "Joining…" : "Join the game"}
            </button>
            {error && <p className="text-red-300 text-sm">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  return <PlayerInGame code={code} playerId={playerId} />;
}

function PlayerInGame({ code, playerId }: { code: string; playerId: string }) {
  const { data, error } = usePoll<PublicGameView>(
    `/api/game/${code}/state`,
    1500,
  );

  if (error && !data) {
    return <Centered>Couldn't reach the server.</Centered>;
  }
  if (!data) return <Centered>Loading…</Centered>;

  const me = data.players.find((p) => p.id === playerId);

  if (data.phase === "lobby") {
    return (
      <main className="min-h-[100dvh] p-6 flex flex-col items-center">
        <div className="max-w-md w-full card text-center space-y-5">
          <p className="label">In the lobby</p>
          <h1 className="text-3xl font-display text-sand">
            Hey {me?.name ?? "—"} 👋
          </h1>
          <p className="text-white/60">
            Waiting for the host to start. {data.players.length} players in.
          </p>
          <Leaderboard players={data.players} highlightId={playerId} />
        </div>
      </main>
    );
  }

  if (data.phase === "finished") {
    return (
      <main className="min-h-[100dvh] p-6 flex flex-col items-center">
        <div className="max-w-md w-full card text-center space-y-5">
          <p className="label">Game over</p>
          <h1 className="text-3xl font-display text-sand">
            🏆 {data.players[0]?.name} wins!
          </h1>
          <Leaderboard players={data.players} highlightId={playerId} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] p-4 flex flex-col items-center">
      <div className="max-w-md w-full space-y-4">
        <div className="card space-y-4">
          <PlayerQuestion data={data} playerId={playerId} code={code} />
        </div>
        <div className="card">
          <p className="label mb-3">Standings</p>
          <Leaderboard
            players={data.players}
            highlightId={playerId}
            showBonus={data.phase === "reveal"}
          />
        </div>
      </div>
    </main>
  );
}

function PlayerQuestion({
  data,
  playerId,
  code,
}: {
  data: PublicGameView;
  playerId: string;
  code: string;
}) {
  const q = data.question;
  const submitted = data.answeredPlayerIds.includes(playerId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = useMemo(() => {
    if (data.phase !== "question" || !data.questionStartedAt) return null;
    const ms = data.questionStartedAt + data.questionDurationMs - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data, now]);

  if (!q) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="label">
            Round {data.questionIndex + 1} of {data.totalQuestions}
          </p>
          {remaining !== null && (
            <p className="font-display text-2xl text-sunset tabular-nums">
              {remaining}s
            </p>
          )}
        </div>
        <RoundDots current={data.questionIndex} total={data.totalQuestions} />
      </div>

      <h2 className="text-2xl font-display text-sand leading-tight">
        {q.prompt}
      </h2>
      {q.image && (
        <img
          src={q.image}
          alt=""
          className="rounded-2xl max-h-64 object-cover w-full"
        />
      )}

      {data.phase === "question" && !submitted && (
        <AnswerInput question={q} code={code} playerId={playerId} />
      )}

      {data.phase === "question" && submitted && (
        <p className="text-center text-green-300 py-4">
          Locked in. Waiting for everyone else…
        </p>
      )}

      {data.phase === "reveal" && data.reveal && (
        <RevealPanel data={data} playerId={playerId} />
      )}
    </div>
  );
}

function AnswerInput({
  question,
  code,
  playerId,
}: {
  question: PublicQuestion;
  code: string;
  playerId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(value: string | number) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/game/${code}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  if (question.kind === "yes_no") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button
          className="btn-primary py-5 text-xl"
          disabled={busy}
          onClick={() => submit("yes")}
        >
          Yes
        </button>
        <button
          className="btn-secondary py-5 text-xl"
          disabled={busy}
          onClick={() => submit("no")}
        >
          No
        </button>
        {err && <p className="col-span-2 text-red-300 text-sm">{err}</p>}
      </div>
    );
  }

  if (question.kind === "higher_lower") {
    return (
      <div className="space-y-3">
        <p className="text-white/70">{question.statement}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-primary py-5 text-xl"
            disabled={busy}
            onClick={() => submit("higher")}
          >
            ↑ Higher
          </button>
          <button
            className="btn-secondary py-5 text-xl"
            disabled={busy}
            onClick={() => submit("lower")}
          >
            ↓ Lower
          </button>
        </div>
        {err && <p className="text-red-300 text-sm">{err}</p>}
      </div>
    );
  }

  if (question.kind === "multiple_choice" && question.choices) {
    return (
      <div className="grid gap-3">
        {question.choices.map((c, i) => (
          <button
            key={i}
            className="btn-secondary justify-start text-left py-4"
            disabled={busy}
            onClick={() => submit(i)}
          >
            <span className="text-sunset mr-3 font-display text-xl">
              {String.fromCharCode(65 + i)}
            </span>
            {c}
          </button>
        ))}
        {err && <p className="text-red-300 text-sm">{err}</p>}
      </div>
    );
  }

  // closest
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(text);
        if (!Number.isFinite(n)) {
          setErr("Enter a number");
          return;
        }
        submit(n);
      }}
      className="space-y-3"
    >
      {question.hint && <p className="text-white/50 text-sm">{question.hint}</p>}
      <div className="flex gap-2">
        <input
          className="input text-center text-2xl"
          type="number"
          inputMode="decimal"
          step="any"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your guess"
        />
        {question.unit && (
          <div className="self-center text-white/60">{question.unit}</div>
        )}
      </div>
      <button className="btn-primary w-full text-lg" disabled={busy}>
        Lock it in
      </button>
      {err && <p className="text-red-300 text-sm">{err}</p>}
    </form>
  );
}

function RevealPanel({
  data,
  playerId,
}: {
  data: PublicGameView;
  playerId: string;
}) {
  const reveal = data.reveal!;
  const mine = reveal.perPlayer.find((x) => x.playerId === playerId);
  const pts = mine?.pointsEarned ?? 0;
  const pct = Math.round((pts / 1000) * 100);
  const roastLine = roast(pts, `${reveal.questionId}:${playerId}`);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white/5 border border-white/10 p-6 text-center">
        <p className="label mb-2">Round result</p>
        <p
          className={`font-display tracking-tight text-7xl ${
            pct >= 70
              ? "text-green-300"
              : pct >= 40
              ? "text-sand"
              : "text-white/70"
          }`}
        >
          {pct}%
        </p>
        <p className="text-white/60 tabular-nums">
          {pts.toLocaleString()} / 1,000 pts
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <p className="label text-[10px]">You said</p>
          <p className="font-semibold text-base mt-1">
            {mine?.value !== null && mine?.value !== undefined
              ? String(mine.value)
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-sunset/15 border border-sunset/40 p-3">
          <p className="label text-[10px] text-sunset/80">Truth</p>
          <p className="font-semibold text-base mt-1 text-sunset">
            {String(reveal.answer)}
            {reveal.unit ? ` ${reveal.unit}` : ""}
          </p>
        </div>
      </div>

      {reveal.funFact && (
        <p className="text-center text-white/60 italic text-sm">
          {reveal.funFact}
        </p>
      )}

      <p className="text-center text-white/80 italic">{roastLine}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 text-white/70">
      {children}
    </main>
  );
}
