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
      <p className="text-center text-black/40 py-6">
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
                ? "bg-forest/10 border-forest/40"
                : "bg-black/[0.03] border-black/5"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-black/40 w-6 tabular-nums">{i + 1}</span>
              <span className="font-semibold truncate">
                {medal} {p.name}
                {isMe && <span className="text-forest"> (you)</span>}
              </span>
            </div>
            <div className="text-right">
              <div className="font-display text-xl tabular-nums">
                {p.score.toLocaleString()}
              </div>
              {showBonus && typeof p.lastRoundPoints === "number" && (
                <div
                  className={`text-xs tabular-nums ${
                    p.lastRoundPoints > 0 ? "text-forest" : "text-black/40"
                  }`}
                >
                  {p.lastRoundPoints > 0 ? `+${p.lastRoundPoints}` : "—"}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
