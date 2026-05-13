"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function host() {
    setCreating(true);
    const res = await fetch("/api/game/create", { method: "POST" });
    const json = await res.json();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`host:${json.code}`, json.hostToken);
    }
    router.push(`/host/${json.code}`);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === 4) router.push(`/play/${c}`);
  }

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full text-center space-y-10">
        <div>
          <p className="label mb-3">Bachelor party · Joshua Tree</p>
          <h1 className="text-6xl sm:text-8xl font-display tracking-tight">
            <span className="text-forest">PHIL</span>
            <span className="text-ink">-GUESSR</span>
          </h1>
          <p className="mt-4 text-black/60 text-lg max-w-md mx-auto">
            Drop a pin. Guess a number. Find out how badly you actually know Phil.
          </p>
        </div>

        <div className="card space-y-6">
          <button
            className="btn-primary w-full text-xl py-4"
            onClick={host}
            disabled={creating}
          >
            {creating ? "Creating lobby…" : "Host the game"}
          </button>

          <div className="flex items-center gap-3 text-black/40">
            <div className="flex-1 h-px bg-black/15" />
            <span className="text-xs uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-black/15" />
          </div>

          <form onSubmit={join} className="space-y-3">
            <label className="label block text-left">Game code</label>
            <input
              className="input text-center tracking-[0.5em] uppercase font-display text-2xl"
              placeholder="ABCD"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn-secondary w-full" type="submit">
              Join as a player
            </button>
          </form>
        </div>

        <p className="text-xs text-black/40">
          Built with Claude Code · for Phil &amp; Michelle
        </p>
      </div>
    </main>
  );
}
