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
import type { LatLng, PublicGameView, PublicRound } from "@/lib/types";
import { MAX_ROUND_POINTS } from "@/lib/types";

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

  if (error && !data) return <Centered>Couldn't reach the server.</Centered>;
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
          Round {data.roundIndex + 1} of {data.totalRounds}
        </p>
      </div>
      <RoundDots current={data.roundIndex} total={data.totalRounds} />
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
  const round = data.round!;
  const submitted = data.answeredPlayerIds.includes(playerId);

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
          <p className="label">
            {kindLabel(round.kind)}
          </p>
          <h2 className="text-2xl font-display leading-tight">{round.title}</h2>
        </div>
        {showPhotoCard(round) && (
          <PhotoCard image={round.image} pills={round.pills} />
        )}
        {remaining !== null && (
          <p className="text-center font-display text-2xl text-forest tabular-nums">
            {remaining}s
          </p>
        )}
      </div>
      <Inputs round={round} code={code} playerId={playerId} />
    </>
  );
}

function showPhotoCard(round: PublicRound): boolean {
  // For non-photo-choice rounds, show a header photo card if there's an image
  // or for map_number rounds always (since pills/photo orient the round)
  if (round.kind === "photo_choice") return false;
  if (round.kind === "map_number") return true;
  if (round.image || (round.pills && round.pills.length)) return true;
  return false;
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

function Inputs({
  round,
  code,
  playerId,
}: {
  round: PublicRound;
  code: string;
  playerId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(payload: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/game/${code}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  if (round.kind === "map_number") {
    return <MapNumberInputs round={round} submit={submit} busy={busy} err={err} />;
  }
  if (round.kind === "number") {
    return <NumberInputs round={round} submit={submit} busy={busy} err={err} />;
  }
  if (round.kind === "multiple_choice") {
    return <TextChoiceInputs round={round} submit={submit} busy={busy} err={err} />;
  }
  if (round.kind === "photo_choice") {
    return <PhotoChoiceInputs round={round} submit={submit} busy={busy} err={err} />;
  }
  if (round.kind === "higher_lower") {
    return <HigherLowerInputs round={round} submit={submit} busy={busy} err={err} />;
  }
  return <YesNoInputs round={round} submit={submit} busy={busy} err={err} />;
}

type SubmitFn = (p: object) => Promise<void>;
type SubProps = { submit: SubmitFn; busy: boolean; err: string | null };

function MapNumberInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "map_number" }> } & SubProps) {
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [number, setNumber] = useState<number>(
    Math.round((round.numericQuestion.min + round.numericQuestion.max) / 2),
  );
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setGuess(null);
    setNumber(Math.round((round.numericQuestion.min + round.numericQuestion.max) / 2));
    setLocked(false);
  }, [round.id]);

  return (
    <>
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Step n={1} done={!!guess} active={!guess} />
          <p className="label">Guess the location — drop a pin</p>
        </div>
        <PinMap value={guess} onChange={setGuess} disabled={locked} />
        <p className="text-xs text-black/50">
          {guess
            ? `Pin placed at ${guess.lat.toFixed(2)}, ${guess.lng.toFixed(2)}`
            : "Pin not placed yet"}
        </p>
        {!locked && (
          <button
            className="btn-primary w-full"
            disabled={!guess}
            onClick={() => setLocked(true)}
          >
            Lock location →
          </button>
        )}
      </div>
      <div className={`card space-y-3 ${!locked ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-2">
          <Step n={2} done={false} active={locked} />
          <p className="label">{round.numericQuestion.label}</p>
        </div>
        <p className="text-base font-medium leading-snug">
          {round.numericQuestion.prompt}
        </p>
        {locked ? (
          <NumberSlider
            min={round.numericQuestion.min}
            max={round.numericQuestion.max}
            step={round.numericQuestion.step}
            unitPrefix={round.numericQuestion.unitPrefix}
            unitSuffix={round.numericQuestion.unitSuffix}
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
          disabled={!locked || busy}
          onClick={() => submit({ guess, number })}
        >
          {busy ? "Submitting…" : "Submit answer →"}
        </button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    </>
  );
}

function NumberInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "number" }> } & SubProps) {
  const [number, setNumber] = useState<number>(
    Math.round((round.numericQuestion.min + round.numericQuestion.max) / 2),
  );
  useEffect(() => {
    setNumber(Math.round((round.numericQuestion.min + round.numericQuestion.max) / 2));
  }, [round.id]);
  return (
    <div className="card space-y-4">
      <p className="text-base font-medium leading-snug">
        {round.numericQuestion.prompt}
      </p>
      <NumberSlider
        min={round.numericQuestion.min}
        max={round.numericQuestion.max}
        step={round.numericQuestion.step}
        unitPrefix={round.numericQuestion.unitPrefix}
        unitSuffix={round.numericQuestion.unitSuffix}
        value={number}
        onChange={setNumber}
      />
      <button
        className="btn-primary w-full"
        disabled={busy}
        onClick={() => submit({ number })}
      >
        {busy ? "Submitting…" : "Lock it in →"}
      </button>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

function TextChoiceInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "multiple_choice" }> } & SubProps) {
  return (
    <div className="card space-y-3">
      <p className="text-base font-medium leading-snug">{round.prompt}</p>
      <div className="grid gap-2">
        {round.choices.map((c, i) => (
          <button
            key={i}
            disabled={busy}
            className="btn-secondary justify-start text-left"
            onClick={() => submit({ choiceIndex: i })}
          >
            <span className="text-forest mr-3 font-display text-xl">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="truncate">{c}</span>
          </button>
        ))}
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

function PhotoChoiceInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "photo_choice" }> } & SubProps) {
  return (
    <div className="card space-y-3">
      <p className="text-base font-medium leading-snug">{round.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {round.choices.map((c, i) => (
          <button
            key={i}
            disabled={busy}
            onClick={() => submit({ choiceIndex: i })}
            className="relative aspect-square rounded-2xl overflow-hidden border border-black/10 active:scale-[0.98] transition disabled:opacity-50"
          >
            <img
              src={c.image}
              alt={c.label ?? String.fromCharCode(65 + i)}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="absolute top-2 left-2 pill">
              {c.label ?? String.fromCharCode(65 + i)}
            </span>
          </button>
        ))}
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

function HigherLowerInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "higher_lower" }> } & SubProps) {
  return (
    <div className="card space-y-3">
      <p className="text-base font-medium leading-snug">{round.prompt}</p>
      <div className="rounded-2xl bg-black/[0.04] p-4 text-center">
        <p className="label">Reference</p>
        <p className="font-display text-3xl">
          {round.unitPrefix}
          {round.reference.toLocaleString()}
          {round.unitSuffix ? ` ${round.unitSuffix}` : ""}
        </p>
        <p className="text-sm text-black/60 mt-1">{round.statement}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={busy}
          onClick={() => submit({ binaryValue: "higher" })}
          className="btn-primary py-5 text-lg"
        >
          ↑ Higher
        </button>
        <button
          disabled={busy}
          onClick={() => submit({ binaryValue: "lower" })}
          className="btn-secondary py-5 text-lg"
        >
          ↓ Lower
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

function YesNoInputs({
  round,
  submit,
  busy,
  err,
}: { round: Extract<PublicRound, { kind: "yes_no" }> } & SubProps) {
  return (
    <div className="card space-y-3">
      <p className="text-base font-medium leading-snug">{round.prompt}</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={busy}
          onClick={() => submit({ binaryValue: "yes" })}
          className="btn-primary py-5 text-lg"
        >
          Yes
        </button>
        <button
          disabled={busy}
          onClick={() => submit({ binaryValue: "no" })}
          className="btn-secondary py-5 text-lg"
        >
          No
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
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
  const round = data.round!;
  const mine = reveal.perPlayer.find((p) => p.playerId === playerId);
  const totalPts = mine?.totalPoints ?? 0;
  const overallPct = Math.round((totalPts / MAX_ROUND_POINTS) * 100);
  const locPct = (mine?.locationPoints ?? 0) / 2500;
  const numPct = (mine?.numberPoints ?? 0) / 2500;
  const roastLine = roast(
    reveal.kind === "map_number" ? locPct : overallPct / 100,
    reveal.kind === "map_number" ? numPct : overallPct / 100,
    `${reveal.roundId}:${playerId}`,
  );

  return (
    <>
      <div className="card text-center space-y-2">
        <p className="label">Round {data.roundIndex + 1} Result</p>
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
        {reveal.kind === "map_number" && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/5">
            <div>
              <p className="label">Location</p>
              <p className="font-display text-3xl">{Math.round(locPct * 100)}%</p>
            </div>
            <div>
              <p className="label">Number</p>
              <p className="font-display text-3xl">{Math.round(numPct * 100)}%</p>
            </div>
          </div>
        )}
      </div>

      <RevealDetails round={round} reveal={reveal} mineGuess={mine?.guess ?? null} mineNumber={mine?.number ?? null} mineChoice={mine?.choiceIndex ?? null} mineBinary={mine?.binaryValue ?? null} distanceKm={mine?.distanceKm ?? 0} />

      {reveal.funFact && (
        <p className="text-center text-black/60 italic text-sm px-2">
          {reveal.funFact}
        </p>
      )}
      <p className="text-center italic px-2">{roastLine}</p>
    </>
  );
}

function RevealDetails({
  round,
  reveal,
  mineGuess,
  mineNumber,
  mineChoice,
  mineBinary,
  distanceKm,
}: {
  round: PublicRound;
  reveal: NonNullable<PublicGameView["reveal"]>;
  mineGuess: LatLng | null;
  mineNumber: number | null;
  mineChoice: number | null;
  mineBinary: string | null;
  distanceKm: number;
}) {
  if (reveal.kind === "map_number" && round.kind === "map_number" && reveal.location) {
    return (
      <div className="card space-y-3">
        <ResultMap guess={mineGuess} answer={reveal.location} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="label">Location</p>
            <p className="font-semibold text-forest text-sm">{reveal.location.label}</p>
            <p className="text-xs text-black/60">
              {mineGuess ? `${Math.round(distanceKm * 0.621)} mi off` : "no guess"}
            </p>
          </div>
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="label">{round.numericQuestion.label}</p>
            <p className="font-semibold text-forest text-sm">
              {round.numericQuestion.unitPrefix}
              {(reveal.numberAnswer ?? 0).toLocaleString()}
              {round.numericQuestion.unitSuffix ? ` ${round.numericQuestion.unitSuffix}` : ""}
            </p>
            <p className="text-xs text-black/60">
              You said{" "}
              {mineNumber !== null
                ? `${round.numericQuestion.unitPrefix ?? ""}${mineNumber.toLocaleString()}${round.numericQuestion.unitSuffix ? " " + round.numericQuestion.unitSuffix : ""}`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (reveal.kind === "number" && round.kind === "number") {
    return (
      <div className="card grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/[0.03] p-3">
          <p className="label">You said</p>
          <p className="font-semibold text-base">
            {mineNumber !== null
              ? `${round.numericQuestion.unitPrefix ?? ""}${mineNumber.toLocaleString()}${round.numericQuestion.unitSuffix ? " " + round.numericQuestion.unitSuffix : ""}`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-forest/10 border border-forest/30 p-3">
          <p className="label text-forest/80">Truth</p>
          <p className="font-semibold text-base text-forest">
            {round.numericQuestion.unitPrefix}
            {(reveal.numberAnswer ?? 0).toLocaleString()}
            {round.numericQuestion.unitSuffix ? ` ${round.numericQuestion.unitSuffix}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (reveal.kind === "multiple_choice" && round.kind === "multiple_choice") {
    return (
      <div className="card space-y-2">
        {round.choices.map((c, i) => {
          const isAnswer = i === reveal.choiceIndex;
          const isMine = i === mineChoice;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                isAnswer
                  ? "bg-forest/10 border-forest/40"
                  : isMine
                  ? "bg-red-50 border-red-200"
                  : "bg-black/[0.03] border-black/5"
              }`}
            >
              <span>
                <span className="text-black/40 mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {c}
              </span>
              {isAnswer && <span className="text-forest font-semibold">✓ Truth</span>}
              {isMine && !isAnswer && (
                <span className="text-red-600 font-semibold text-sm">You</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (reveal.kind === "photo_choice" && round.kind === "photo_choice") {
    return (
      <div className="card grid grid-cols-2 gap-2">
        {round.choices.map((c, i) => {
          const isAnswer = i === reveal.choiceIndex;
          const isMine = i === mineChoice;
          return (
            <div
              key={i}
              className={`relative aspect-square rounded-2xl overflow-hidden border-2 ${
                isAnswer
                  ? "border-forest"
                  : isMine
                  ? "border-red-400"
                  : "border-transparent"
              }`}
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
              {isAnswer && (
                <span className="absolute bottom-2 left-2 pill bg-forest">
                  ✓ Truth
                </span>
              )}
              {isMine && !isAnswer && (
                <span className="absolute bottom-2 left-2 pill bg-red-500">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (
    (reveal.kind === "higher_lower" && round.kind === "higher_lower") ||
    (reveal.kind === "yes_no" && round.kind === "yes_no")
  ) {
    const truth = reveal.binaryAnswer ?? "";
    const mine = mineBinary ?? "—";
    const correct = mine === truth;
    return (
      <div className="card grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/[0.03] p-3 text-center">
          <p className="label">You said</p>
          <p className={`font-semibold text-lg capitalize ${correct ? "text-forest" : "text-red-600"}`}>
            {mine}
          </p>
        </div>
        <div className="rounded-2xl bg-forest/10 border border-forest/30 p-3 text-center">
          <p className="label text-forest/80">Truth</p>
          <p className="font-semibold text-lg text-forest capitalize">{truth}</p>
        </div>
      </div>
    );
  }

  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 text-black/60">
      {children}
    </main>
  );
}
