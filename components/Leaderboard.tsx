import type { Player } from "@/lib/types";

export function Leaderboard({
  players,
  highlightId,
  showBonus,
}: {
  players: Player[];
  highlightId?: string;
  showBonus?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="text-center text-white/50 py-6">
        Waiting for players to join…
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {players.map((p, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
        const isMe = highlightId && p.id === highlightId;
        return (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 border ${
              isMe
                ? "bg-sunset/20 border-sunset"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-white/40 w-6 tabular-nums">{i + 1}</span>
              <span className="font-semibold">
                {medal} {p.name}
                {isMe && <span className="text-sunset"> (you)</span>}
              </span>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-sand tabular-nums">
                {p.score.toLocaleString()}
              </div>
              {showBonus && typeof p.lastBonus === "number" && (
                <div
                  className={`text-xs tabular-nums ${
                    p.lastBonus > 0 ? "text-green-300" : "text-white/40"
                  }`}
                >
                  {p.lastBonus > 0 ? `+${p.lastBonus}` : "—"}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
