// Editor state and the drawing routine shared by the live preview and exports.

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "image"; src: string; label: string };

export interface EditorSettings {
  background: Background;
  /** Background blur, 0–20 (relative to image size). */
  bgBlur: number;
  brightness: number; // %
  contrast: number; // %
  saturation: number; // %
  scale: number; // 1 = 100%
  rotation: number; // degrees
  offsetX: number; // composition px
  offsetY: number;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  background: { kind: "transparent" },
  bgBlur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

// Swatch values are user-pickable image colors, not UI styling.
export const SOLID_COLORS = [
  { label: "White", color: "#ffffff" },
  { label: "Black", color: "#000000" },
  { label: "Red", color: "#ef4444" },
  { label: "Blue", color: "#3b82f6" },
  { label: "Green", color: "#22c55e" },
  { label: "Yellow", color: "#facc15" },
  { label: "Light gray", color: "#e5e7eb" },
  { label: "Navy", color: "#1e293b" },
];

export const GRADIENTS = [
  { label: "Violet", from: "#635bff", to: "#8b5cf6", angle: 135 },
  { label: "Sunset", from: "#f97316", to: "#ec4899", angle: 135 },
  { label: "Ocean", from: "#06b6d4", to: "#3b82f6", angle: 160 },
  { label: "Mint", from: "#a7f3d0", to: "#22d3ee", angle: 120 },
  { label: "Peach", from: "#fde68a", to: "#fca5a5", angle: 135 },
  { label: "Midnight", from: "#0f172a", to: "#4338ca", angle: 160 },
];

export function backgroundsEqual(a: Background, b: Background): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Map a point on the composition to the cut-out's own pixel grid. */
export function compositionToSubject(
  x: number,
  y: number,
  w: number,
  h: number,
  s: Pick<EditorSettings, "offsetX" | "offsetY" | "rotation" | "scale">,
): { x: number; y: number } {
  const dx = x - w / 2 - s.offsetX;
  const dy = y - h / 2 - s.offsetY;
  const rad = (-s.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return { x: rx / s.scale + w / 2, y: ry / s.scale + h / 2 };
}

/**
 * Draw background + subject onto ctx in composition units (w × h).
 * `pixelScale` is output px per composition px, so blur looks the same at any export size.
 */
export function renderComposition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: EditorSettings,
  subject: CanvasImageSource,
  bgImage: HTMLImageElement | null,
  pixelScale = 1,
) {
  ctx.save();
  const bg = s.background;
  if (bg.kind === "color") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === "gradient") {
    const rad = (bg.angle * Math.PI) / 180;
    const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    const cx = w / 2;
    const cy = h / 2;
    const dx = (Math.sin(rad) * len) / 2;
    const dy = (-Math.cos(rad) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === "image" && bgImage && bgImage.naturalWidth) {
    const blurPx = (s.bgBlur / 1000) * Math.max(w, h) * pixelScale;
    // Over-draw slightly when blurred so edges don't fade to transparent.
    const pad = blurPx > 0 ? (blurPx * 2) / pixelScale : 0;
    const scale = Math.max((w + pad * 2) / bgImage.naturalWidth, (h + pad * 2) / bgImage.naturalHeight);
    const iw = bgImage.naturalWidth * scale;
    const ih = bgImage.naturalHeight * scale;
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(bgImage, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.filter = "none";
  }
  ctx.restore();

  ctx.save();
  ctx.translate(w / 2 + s.offsetX, h / 2 + s.offsetY);
  ctx.rotate((s.rotation * Math.PI) / 180);
  ctx.scale(s.scale, s.scale);
  if (s.brightness !== 100 || s.contrast !== 100 || s.saturation !== 100) {
    ctx.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%)`;
  }
  ctx.drawImage(subject, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export function supportsWebpExport(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c.toDataURL("image/webp").startsWith("data:image/webp");
}
