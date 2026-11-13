import { useRef } from "react";
import { Ban, ImagePlus, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { GRADIENTS, SOLID_COLORS, backgroundsEqual, type Background } from "@/lib/pixelcut/editor";
import { PHOTO_BACKGROUNDS } from "@/lib/pixelcut/backgrounds";
import { validateImageFile } from "@/lib/pixelcut/files";
import { toast } from "sonner";

interface Props {
  value: Background;
  onChange: (bg: Background) => void;
  customImages: { src: string; label: string }[];
  onAddCustomImage: (img: { src: string; label: string }) => void;
}

function Swatch({ active, onClick, label, children, style, className }: {
  active: boolean;
  onClick: () => void;
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={style}
      className={cn(
        "relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border transition-all hover:scale-[1.04]",
        active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function BackgroundSelector({ value, onChange, customImages, onAddCustomImage }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const customColor = value.kind === "color" && !SOLID_COLORS.some((c) => c.color === value.color) ? value.color : "#635bff";

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Solid colors</h4>
        <div className="grid grid-cols-5 gap-2">
          <Swatch active={value.kind === "transparent"} onClick={() => onChange({ kind: "transparent" })} label="Transparent" className="bg-checker">
            <Ban className="h-4 w-4 text-muted-foreground" />
          </Swatch>
          {SOLID_COLORS.map((c) => (
            <Swatch
              key={c.color}
              label={c.label}
              active={backgroundsEqual(value, { kind: "color", color: c.color })}
              onClick={() => onChange({ kind: "color", color: c.color })}
              style={{ background: c.color }}
            />
          ))}
          <label
            title="Custom color"
            className={cn(
              "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.04]",
              value.kind === "color" && !SOLID_COLORS.some((c) => c.color === value.color) && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
            style={value.kind === "color" && !SOLID_COLORS.some((c) => c.color === value.color) ? { background: value.color } : undefined}
          >
            <Pipette className="h-4 w-4 text-muted-foreground mix-blend-difference" />
            <input
              type="color"
              aria-label="Custom color"
              value={customColor}
              onChange={(e) => onChange({ kind: "color", color: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Gradients</h4>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {GRADIENTS.map((g) => {
            const bg: Background = { kind: "gradient", from: g.from, to: g.to, angle: g.angle };
            return (
              <Swatch
                key={g.label}
                label={g.label}
                active={backgroundsEqual(value, bg)}
                onClick={() => onChange(bg)}
                style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                className="w-11 lg:w-auto"
              />
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Photos</h4>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Upload your own
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {[...customImages.map((c) => ({ ...c, category: "Yours" })), ...PHOTO_BACKGROUNDS].map((p) => {
            const bg: Background = { kind: "image", src: p.src, label: p.label };
            return (
              <Swatch key={p.src} label={p.label} active={value.kind === "image" && value.src === p.src} onClick={() => onChange(bg)} className="w-20 lg:w-auto">
                <img src={p.src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-foreground/55 px-1 py-0.5 text-[10px] font-semibold text-background">
                  {p.category}
                </span>
              </Swatch>
            );
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const check = validateImageFile(f);
            if (!check.ok) {
              toast.error(check.error);
              return;
            }
            const img = { src: URL.createObjectURL(f), label: f.name };
            onAddCustomImage(img);
            onChange({ kind: "image", src: img.src, label: img.label });
          }}
        />
      </div>
    </div>
  );
}
