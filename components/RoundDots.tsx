export function RoundDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current
              ? "w-6 bg-forest"
              : i === current
              ? "w-8 bg-leaf"
              : "w-4 bg-black/10"
          }`}
        />
      ))}
    </div>
  );
}
