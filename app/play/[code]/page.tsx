"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { Leaderboard } from "@/components/Leaderboard";
import { RoundDots } from "@/components/RoundDots";
import { PhotoCard } from "@/components/PhotoCard";
import { PinMap, ResultMap } from "@/components/MapWrapper";
import { NumberSlider } from "@/components/Slider";
import { roast } from "@/lib/roast";
import type { LatLng, PublicGameView } from "@/lib/types";
import { MAX_LOCATION_POINTS, MAX_NUMBER_POINTS, MAX_ROUND_POINTS } from "@/lib/types";

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
            <p className="label">Joining</p>
            <p className="font-display text-5xl text-forest tracking-widest">
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
            <button className="btn-primary w-full" disabled={joining || !name.trim()}>
              {joining ? "Joining…" : "Join the game"}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
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
          <h1 className="text-3xl font-display">Hey {me?.name ?? "—"} 👋</h1>
          <p className="text-black/60">
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
          <h1 className="text-3xl font-display">
            🏆 {data.players[0]?.name} wins!
          </h1>
          <Leaderboard players={data.players} highlightId={playerId} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] p-4 flex flex-col items-center safe-bottom">
      <div className="max-w-md w-full space-y-4">
        <Header data={data} />
        {data.phase === "round" && (
          <RoundBody data={data} playerId={playerId} code={code} />
        )}
        {data.phase === "reveal" && data.reveal && (
          <RevealBody data={data} playerId={playerId} />
        )}
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

function Header({ data }: { data: PublicGameView }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-xl tracking-widest">PHIL-GUESSR</p>
        <p className="text-xs text-black/50 tabular-nums">
          Round {data.placeIndex + 1} of {data.totalPlaces}
        </p>
      </div>
      <RoundDots current={data.placeIndex} total={data.totalPlaces} />
    </div>
  );
}

function RoundBody({
  data,
  playerId,
  code,
}: {
  data: PublicGameView;
  playerId: string;
  code: string;
}) {
  const place = data.place!;
  const submitted = data.answeredPlayerIds.includes(playerId);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [number, setNumber] = useState<number>(
    Math.round(
      (place.numericQuestion.min + place.numericQuestion.max) / 2,
    ),
  );
  const [locationSubmitted, setLocationSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset when round changes
  useEffect(() => {
    setGuess(null);
    setNumber(
      Math.round(
        (place.numericQuestion.min + place.numericQuestion.max) / 2,
      ),
    );
    setLocationSubmitted(false);
    setErr(null);
  }, [place.id]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = useMemo(() => {
    if (!data.roundStartedAt) return null;
    const ms = data.roundStartedAt + data.roundDurationMs - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data, now]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/game/${code}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, guess, number }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="card text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold">Locked in.</p>
        <p className="text-black/60 text-sm">Waiting for everyone else…</p>
      </div>
    );
  }

  return (
    <>
      <div className="card space-y-4">
        <div>
          <p className="label">Place</p>
          <h2 className="text-2xl font-display leading-tight">{place.title}</h2>
        </div>
        <PhotoCard place={place} />
        {remaining !== null && (
          <p className="text-center font-display text-2xl text-forest tabular-nums">
            {remaining}s
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Step n={1} done={!!guess} active={!guess} />
          <p className="label">Guess the location — drop a pin</p>
        </div>
        <PinMap value={guess} onChange={setGuess} disabled={locationSubmitted} />
        <p className="text-xs text-black/50">
          {guess
            ? `Pin placed at ${guess.lat.toFixed(2)}, ${guess.lng.toFixed(2)}`
            : "Pin not placed yet"}
        </p>
        {!locationSubmitted && (
          <button
            className="btn-primary w-full"
            disabled={!guess}
            onClick={() => setLocationSubmitted(true)}
          >
            Lock location →
          </button>
        )}
      </div>

      <div className={`card space-y-3 ${!locationSubmitted ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-2">
          <Step n={2} done={false} active={locationSubmitted} />
          <p className="label">{place.numericQuestion.label}</p>
        </div>
        <p className="text-base font-medium leading-snug">
          {place.numericQuestion.prompt}
        </p>
        {locationSubmitted ? (
          <NumberSlider
            min={place.numericQuestion.min}
            max={place.numericQuestion.max}
            step={place.numericQuestion.step}
            unitPrefix={place.numericQuestion.unitPrefix}
            unitSuffix={place.numericQuestion.unitSuffix}
            value={number}
            onChange={setNumber}
          />
        ) : (
          <p className="text-center text-black/40 py-6 text-sm">
            Lock the location first to unlock the slider.
          </p>
        )}
        <button
          className="btn-primary w-full"
          disabled={!locationSubmitted || busy}
          onClick={submit}
        >
          {busy ? "Submitting…" : "Submit answer →"}
        </button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    </>
  );
}

function Step({
  n,
  done,
  active,
}: {
  n: number;
  done: boolean;
  active: boolean;
}) {
  const base = "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold";
  if (done) return <div className={`${base} bg-forest text-white`}>✓</div>;
  if (active) return <div className={`${base} bg-leaf text-white`}>{n}</div>;
  return <div className={`${base} bg-black/10 text-black/40`}>{n}</div>;
}

function RevealBody({
  data,
  playerId,
}: {
  data: PublicGameView;
  playerId: string;
}) {
  const reveal = data.reveal!;
  const place = data.place!;
  const mine = reveal.perPlayer.find((p) => p.playerId === playerId);
  const totalPts = mine?.totalPoints ?? 0;
  const locPct = (mine?.locationPoints ?? 0) / MAX_LOCATION_POINTS;
  const numPct = (mine?.numberPoints ?? 0) / MAX_NUMBER_POINTS;
  const overallPct = Math.round((totalPts / MAX_ROUND_POINTS) * 100);
  const roastLine = roast(locPct, numPct, `${reveal.placeId}:${playerId}`);

  return (
    <>
      <div className="card text-center space-y-2">
        <p className="label">Round {data.placeIndex + 1} Result</p>
        <p
          className={`font-display tracking-tight text-7xl ${
            overallPct >= 70
              ? "text-forest"
              : overallPct >= 40
              ? "text-ink"
              : "text-black/60"
          }`}
        >
          {overallPct}%
        </p>
        <p className="text-black/60 tabular-nums">
          {totalPts.toLocaleString()} / {MAX_ROUND_POINTS.toLocaleString()} pts
        </p>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/5">
          <div>
            <p className="label">Location</p>
            <p className="font-display text-3xl">{Math.round(locPct * 100)}%</p>
          </div>
          <div>
            <p className="label">{place.numericQuestion.label}</p>
            <p className="font-display text-3xl">{Math.round(numPct * 100)}%</p>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <ResultMap guess={mine?.guess ?? null} answer={reveal.location} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="label">Location</p>
            <p className="font-semibold text-forest">{reveal.location.label}</p>
            <p className="text-xs text-black/60">
              {mine?.guess
                ? `${Math.round((mine?.distanceKm ?? 0) * 0.621)} mi off`
                : "no guess"}
            </p>
          </div>
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="label">{place.numericQuestion.label}</p>
            <p className="font-semibold text-forest">
              {place.numericQuestion.unitPrefix}
              {reveal.numberAnswer.toLocaleString()}
              {place.numericQuestion.unitSuffix ? ` ${place.numericQuestion.unitSuffix}` : ""}
            </p>
            <p className="text-xs text-black/60">
              You said{" "}
              {mine?.number !== null && mine?.number !== undefined
                ? `${place.numericQuestion.unitPrefix ?? ""}${mine.number.toLocaleString()}${place.numericQuestion.unitSuffix ? " " + place.numericQuestion.unitSuffix : ""}`
                : "—"}
            </p>
          </div>
        </div>
        {reveal.funFact && (
          <p className="text-center text-black/60 italic text-sm pt-1">
            {reveal.funFact}
          </p>
        )}
        <p className="text-center italic">{roastLine}</p>
      </div>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 text-black/60">
      {children}
    </main>
  );
}
