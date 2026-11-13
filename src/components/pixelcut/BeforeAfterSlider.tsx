import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  before: string;
  after: string;
  alt: string;
  className?: string;
  /** Background shown behind the cut-out; defaults to a transparency checkerboard. */
  afterBackground?: string;
}

export function BeforeAfterSlider({ before, after, alt, className, afterBackground }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative select-none overflow-hidden rounded-2xl touch-none", className)}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* After (cut-out) */}
      <div className={cn("absolute inset-0", !afterBackground && "bg-checker")} style={afterBackground ? { background: afterBackground } : undefined}>
        <img src={after} alt={`${alt} with background removed`} className="h-full w-full object-contain" draggable={false} />
      </div>
      {/* Before (original), clipped to the left of the handle */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={`${alt} original`} className="h-full w-full object-cover" draggable={false} />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-soft">Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-soft">After</span>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-card shadow-soft" />
        <div className="absolute top-1/2 -ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border">
          <ChevronsLeftRight className="h-5 w-5" />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="sr-only"
      />
    </div>
  );
}
