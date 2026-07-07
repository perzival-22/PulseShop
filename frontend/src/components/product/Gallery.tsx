import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollTo = (idx: number) => {
    setActive(idx);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-card bg-stone-100">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${alt} — image ${i + 1}`}
              className="aspect-square w-full flex-shrink-0 snap-center object-cover"
            />
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                onClick={() => scrollTo(i)}
                className={cn(
                  "size-2 rounded-full transition-all",
                  i === active ? "w-5 bg-white" : "bg-white/60",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => scrollTo(i)}
              className={cn(
                "size-16 flex-shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 transition-all",
                i === active ? "ring-primary" : "ring-transparent",
              )}
            >
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
