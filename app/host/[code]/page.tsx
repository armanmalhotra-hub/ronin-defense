"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { QrCode } from "@/components/QrCode";
import { Leaderboard } from "@/components/Leaderboard";
import { RoundDots } from "@/components/RoundDots";
import { PhotoCard } from "@/components/PhotoCard";
import { ResultMap } from "@/components/MapWrapper";
import type { PublicGameView, PublicRound } from "@/lib/types";

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

  if (error && !data) return <Centered>Couldn't reach the server. {error}</Centered>;
  if (!data) return <Centered>Loading lobby…</Centered>;

  if (data.phase === "lobby") {
    return (
      <main className="min-h-[100dvh] p-6 sm:p-10 flex flex-col items-center">
        <div className="max-w-5xl w-full grid sm:grid-cols-2 gap-8">
          <div className="card flex flex-col items-center text-center gap-4">
            <p className="font-display text-2xl tracking-widest">PHIL-GUESSR</p>
            <p className="label">Scan to join</p>
            {joinUrl && <QrCode value={joinUrl} size={260} />}
            <div>
              <p className="text-black/60 text-sm">Or visit</p>
              <p className="font-mono text-forest text-sm break-all">{joinUrl}</p>
            </div>
            <div className="mt-4">
              <p className="label">Game code</p>
              <p className="font-display text-7xl tracking-widest text-forest">
                {code}
              </p>
            </div>
          </div>

          <div className="card flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-display">Players</h2>
              <span className="text-black/50">{data.players.length} joined</span>
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
              <p className="text-xs text-red-600">
                Host token missing. Create a new game from the homepage.
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
      <main className="min-h-[100dvh] p-6 sm:p-10 flex flex-col items-center">
        <div className="max-w-3xl w-full card text-center space-y-6">
          <p className="label">Final standings</p>
          <h1 className="text-5xl font-display">🏆 Champion 🏆</h1>
          <p className="text-3xl text-forest font-display">{winner?.name ?? "—"}</p>
          <p className="text-black/60">
            with {winner?.score.toLocaleString() ?? 0} points
          </p>
          <Leaderboard players={data.players} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] p-6 sm:p-10 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card flex flex-col gap-5">
        <HostMain data={data} />
      </div>
      <div className="card flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-display">Standings</h2>
          <span className="text-black/50 text-sm">
            Round {data.roundIndex + 1} / {data.totalRounds}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <Leaderboard
            players={data.players}
            showBonus={data.phase === "reveal"}
          />
        </div>
        <button className="btn-primary text-lg" onClick={advance} disabled={!hostToken}>
          {data.phase === "round"
            ? "Reveal answer →"
            : data.roundIndex + 1 >= data.totalRounds
            ? "Show final results →"
            : "Next round →"}
        </button>
      </div>
    </main>
  );
}

function HostMain({ data }: { data: PublicGameView }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const remaining = useMemo(() => {
    if (data.phase !== "round" || !data.roundStartedAt) return null;
    const ms = data.roundStartedAt + data.roundDurationMs - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data, now]);

  const round = data.round;
  const reveal = data.reveal;
  if (!round) return null;
  const answeredCount = data.answeredPlayerIds.length;
  const totalPlayers = data.players.length;

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl tracking-widest">PHIL-GUESSR</p>
        {remaining !== null && (
          <p className="font-display text-3xl text-forest tabular-nums">{remaining}s</p>
        )}
      </div>
      <div className="space-y-2">
        <p className="label">
          Round {data.roundIndex + 1} of {data.totalRounds} · {kindLabel(round.kind)}
        </p>
        <RoundDots current={data.roundIndex} total={data.totalRounds} />
      </div>

      <h2 className="text-4xl font-display leading-tight">{round.title}</h2>
      <HostQuestion round={round} />

      <p className="text-black/60">
        Answered:{" "}
        <span className="font-semibold text-ink">
          {answeredCount} / {totalPlayers}
        </span>
      </p>

      {data.phase === "reveal" && reveal && (
        <HostReveal round={round} reveal={reveal} />
      )}
    </div>
  );
}

function HostQuestion({ round }: { round: PublicRound }) {
  if (round.kind === "map_number") {
    return (
      <>
        <PhotoCard image={round.image} pills={round.pills} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/[0.03] p-4">
            <p className="label">Step 1</p>
            <p className="font-semibold">Drop a pin on the map</p>
          </div>
          <div className="rounded-2xl bg-black/[0.03] p-4">
            <p className="label">Step 2 — {round.numericQuestion.label}</p>
            <p className="font-semibold">{round.numericQuestion.prompt}</p>
          </div>
        </div>
      </>
    );
  }
  if (round.kind === "number") {
    return (
      <div className="rounded-2xl bg-black/[0.03] p-5">
        <p className="label">{round.numericQuestion.label}</p>
        <p className="text-xl font-semibold mt-1">{round.numericQuestion.prompt}</p>
        <p className="text-sm text-black/50 mt-2">
          Slider range: {round.numericQuestion.unitPrefix}
          {round.numericQuestion.min.toLocaleString()} →{" "}
          {round.numericQuestion.unitPrefix}
          {round.numericQuestion.max.toLocaleString()}
          {round.numericQuestion.unitSuffix ? ` ${round.numericQuestion.unitSuffix}` : ""}
        </p>
      </div>
    );
  }
  if (round.kind === "multiple_choice") {
    return (
      <>
        {round.image && <PhotoCard image={round.image} pills={round.pills} />}
        <p className="text-2xl">{round.prompt}</p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {round.choices.map((c, i) => (
            <li key={i} className="rounded-xl bg-black/[0.03] px-4 py-3">
              <span className="text-black/40 mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {c}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (round.kind === "photo_choice") {
    return (
      <>
        <p className="text-2xl">{round.prompt}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {round.choices.map((c, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-2xl overflow-hidden bg-black/5 border border-black/10"
            >
              <img
                src={c.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="absolute top-2 left-2 pill">
                {c.label ?? String.fromCharCode(65 + i)}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (round.kind === "higher_lower") {
    return (
      <>
        {round.image && <PhotoCard image={round.image} pills={round.pills} />}
        <p className="text-2xl">{round.prompt}</p>
        <div className="rounded-2xl bg-black/[0.04] p-5 text-center">
          <p className="label">Reference</p>
          <p className="font-display text-5xl">
            {round.unitPrefix}
            {round.reference.toLocaleString()}
            {round.unitSuffix ? ` ${round.unitSuffix}` : ""}
          </p>
          <p className="text-sm text-black/60 mt-1">{round.statement}</p>
        </div>
      </>
    );
  }
  // yes_no
  return (
    <>
      {round.image && <PhotoCard image={round.image} pills={round.pills} />}
      <p className="text-2xl">{round.prompt}</p>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-black/[0.03] p-4 font-display text-3xl">Yes</div>
        <div className="rounded-2xl bg-black/[0.03] p-4 font-display text-3xl">No</div>
      </div>
    </>
  );
}

function HostReveal({
  round,
  reveal,
}: {
  round: PublicRound;
  reveal: NonNullable<PublicGameView["reveal"]>;
}) {
  if (round.kind === "map_number" && reveal.kind === "map_number" && reveal.location) {
    return (
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-forest/10 border border-forest/30 p-4">
            <p className="label">Location answer</p>
            <p className="text-2xl font-display text-forest">{reveal.location.label}</p>
          </div>
          <div className="rounded-2xl bg-forest/10 border border-forest/30 p-4">
            <p className="label">{round.numericQuestion.label}</p>
            <p className="text-2xl font-display text-forest">
              {round.numericQuestion.unitPrefix}
              {(reveal.numberAnswer ?? 0).toLocaleString()}
              {round.numericQuestion.unitSuffix ? ` ${round.numericQuestion.unitSuffix}` : ""}
            </p>
          </div>
        </div>
        <ResultMap guess={null} answer={reveal.location} />
        {reveal.funFact && (
          <p className="text-center text-black/60 italic">{reveal.funFact}</p>
        )}
      </div>
    );
  }
  if (round.kind === "number" && reveal.kind === "number") {
    return (
      <div className="rounded-2xl bg-forest/10 border border-forest/30 p-5 text-center">
        <p className="label">Answer</p>
        <p className="text-4xl font-display text-forest">
          {round.numericQuestion.unitPrefix}
          {(reveal.numberAnswer ?? 0).toLocaleString()}
          {round.numericQuestion.unitSuffix ? ` ${round.numericQuestion.unitSuffix}` : ""}
        </p>
        {reveal.funFact && (
          <p className="text-black/60 italic mt-2">{reveal.funFact}</p>
        )}
      </div>
    );
  }
  if (round.kind === "multiple_choice" && reveal.kind === "multiple_choice") {
    return (
      <div className="rounded-2xl bg-forest/10 border border-forest/30 p-5">
        <p className="label">Answer</p>
        <p className="text-2xl font-display text-forest">
          {String.fromCharCode(65 + (reveal.choiceIndex ?? 0))}.{" "}
          {round.choices[reveal.choiceIndex ?? 0]}
        </p>
        {reveal.funFact && (
          <p className="text-black/60 italic mt-2">{reveal.funFact}</p>
        )}
      </div>
    );
  }
  if (round.kind === "photo_choice" && reveal.kind === "photo_choice") {
    const correct = round.choices[reveal.choiceIndex ?? 0];
    return (
      <div className="rounded-2xl bg-forest/10 border border-forest/30 p-4">
        <p className="label">Answer</p>
        <p className="text-2xl font-display text-forest">
          {correct?.label ?? String.fromCharCode(65 + (reveal.choiceIndex ?? 0))}
        </p>
        {correct?.image && (
          <img
            src={correct.image}
            alt=""
            className="mt-3 rounded-xl max-h-60 mx-auto"
          />
        )}
        {reveal.funFact && (
          <p className="text-black/60 italic mt-2 text-center">{reveal.funFact}</p>
        )}
      </div>
    );
  }
  if (
    (round.kind === "higher_lower" && reveal.kind === "higher_lower") ||
    (round.kind === "yes_no" && reveal.kind === "yes_no")
  ) {
    return (
      <div className="rounded-2xl bg-forest/10 border border-forest/30 p-5 text-center">
        <p className="label">Answer</p>
        <p className="text-4xl font-display text-forest capitalize">
          {reveal.binaryAnswer ?? ""}
        </p>
        {reveal.funFact && (
          <p className="text-black/60 italic mt-2">{reveal.funFact}</p>
        )}
      </div>
    );
  }
  return null;
}

function kindLabel(k: PublicRound["kind"]): string {
  switch (k) {
    case "map_number": return "Place + number";
    case "number": return "Closest wins";
    case "multiple_choice": return "Multiple choice";
    case "photo_choice": return "Pick a photo";
    case "higher_lower": return "Higher or lower";
    case "yes_no": return "Yes or no";
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 text-black/60">
      {children}
    </main>
  );
}
