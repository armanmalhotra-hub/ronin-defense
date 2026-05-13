"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { QrCode } from "@/components/QrCode";
import { Leaderboard } from "@/components/Leaderboard";
import { RoundDots } from "@/components/RoundDots";
import { PhotoCard } from "@/components/PhotoCard";
import { ResultMap } from "@/components/MapWrapper";
import type { PublicGameView } from "@/lib/types";
import { MAX_ROUND_POINTS } from "@/lib/types";

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
            Round {data.placeIndex + 1} / {data.totalPlaces}
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
            : data.placeIndex + 1 >= data.totalPlaces
            ? "Show final results →"
            : "Next place →"}
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

  const place = data.place;
  const reveal = data.reveal;
  if (!place) return null;
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
          Round {data.placeIndex + 1} of {data.totalPlaces}
        </p>
        <RoundDots current={data.placeIndex} total={data.totalPlaces} />
      </div>

      <h2 className="text-4xl font-display leading-tight">{place.title}</h2>
      <PhotoCard place={place} />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/[0.03] p-4">
          <p className="label">Step 1</p>
          <p className="font-semibold">Drop a pin on the map</p>
        </div>
        <div className="rounded-2xl bg-black/[0.03] p-4">
          <p className="label">Step 2 — {place.numericQuestion.label}</p>
          <p className="font-semibold">{place.numericQuestion.prompt}</p>
        </div>
      </div>

      <p className="text-black/60">
        Answered:{" "}
        <span className="font-semibold text-ink">
          {answeredCount} / {totalPlayers}
        </span>
      </p>

      {data.phase === "reveal" && reveal && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-forest/10 border border-forest/30 p-4">
              <p className="label">Location answer</p>
              <p className="text-2xl font-display text-forest">
                {reveal.location.label}
              </p>
            </div>
            <div className="rounded-2xl bg-forest/10 border border-forest/30 p-4">
              <p className="label">{place.numericQuestion.label}</p>
              <p className="text-2xl font-display text-forest">
                {place.numericQuestion.unitPrefix}
                {reveal.numberAnswer.toLocaleString()}
                {place.numericQuestion.unitSuffix
                  ? ` ${place.numericQuestion.unitSuffix}`
                  : ""}
              </p>
            </div>
          </div>
          <ResultMap guess={null} answer={reveal.location} />
          {reveal.funFact && (
            <p className="text-center text-black/60 italic">{reveal.funFact}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 text-black/60">
      {children}
    </main>
  );
}
