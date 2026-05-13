import type { PublicPlace } from "@/lib/types";

export function PhotoCard({ place }: { place: PublicPlace }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/10 aspect-[16/10]">
      {place.image ? (
        <img
          src={place.image}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-200">
          <span className="text-4xl">📍</span>
        </div>
      )}
      {place.pills && place.pills.length > 0 && (
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {place.pills.map((p) => (
            <span key={p} className="pill">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
