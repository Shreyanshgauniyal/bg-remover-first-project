import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eraser,
  Eye,
  Hand,
  Loader2,
  Maximize,
  Move,
  Paintbrush,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
  Palette,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  compositionToSubject,
  loadImage,
  renderComposition,
  type Background,
  type EditorSettings,
} from "@/lib/pixelcut/editor";
import { baseName } from "@/lib/pixelcut/files";
import { BackgroundSelector } from "./BackgroundSelector";
import { ExportDialog } from "./ExportDialog";

type Tool = "move" | "pan" | "erase" | "restore";
type HistoryEntry = { settings: EditorSettings; subject: ImageData };

interface Props {
  originalUrl: string;
  cutoutUrl: string;
  filename: string;
  originalSize: { width: number; height: number } | null;
  onStartOver: () => void;
}

const MAX_HISTORY = 30;

export function ImageEditor({ originalUrl, cutoutUrl, filename, originalSize, onStartOver }: Props) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hIndex, setHIndex] = useState(0);
  const currentSubjectData = useRef<ImageData | null>(null);

  const subjectCanvas = useRef<HTMLCanvasElement | null>(null);
  const originalCanvas = useRef<HTMLCanvasElement | null>(null);
  const displayCanvas = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("move");
  const [brushSize, setBrushSize] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [compare, setCompare] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [customImages, setCustomImages] = useState<{ src: string; label: string }[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const bgCache = useRef(new Map<string, HTMLImageElement>());
  const [bgTick, setBgTick] = useState(0);

  // ---- Load images -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    Promise.all([loadImage(cutoutUrl), loadImage(originalUrl)])
      .then(([cut, orig]) => {
        if (cancelled) return;
        const w = cut.naturalWidth;
        const h = cut.naturalHeight;
        const s = document.createElement("canvas");
        s.width = w;
        s.height = h;
        const sctx = s.getContext("2d", { willReadFrequently: true })!;
        sctx.drawImage(cut, 0, 0);
        const o = document.createElement("canvas");
        o.width = w;
        o.height = h;
        o.getContext("2d")!.drawImage(orig, 0, 0, w, h);
        subjectCanvas.current = s;
        originalCanvas.current = o;
        const initial = sctx.getImageData(0, 0, w, h);
        currentSubjectData.current = initial;
        setHistory([{ settings: DEFAULT_SETTINGS, subject: initial }]);
        setHIndex(0);
        setSettings(DEFAULT_SETTINGS);
        setDims({ width: w, height: h });
        setReady(true);
      })
      .catch(() => !cancelled && setLoadError("We couldn't open this image in the editor."));
    return () => {
      cancelled = true;
    };
  }, [cutoutUrl, originalUrl]);

  // ---- Background image cache -------------------------------------------
  const bg = settings.background;
  useEffect(() => {
    if (bg.kind !== "image" || bgCache.current.has(bg.src)) return;
    loadImage(bg.src).then((img) => {
      bgCache.current.set(bg.src, img);
      setBgTick((t) => t + 1);
    });
  }, [bg]);
  const bgImageFor = (b: Background) => (b.kind === "image" ? bgCache.current.get(b.src) ?? null : null);

  // ---- Drawing ------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = displayCanvas.current;
    const subject = subjectCanvas.current;
    if (!canvas || !subject || !dims.width) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, dims.width, dims.height);
    if (compare && originalCanvas.current) {
      ctx.drawImage(originalCanvas.current, 0, 0);
      return;
    }
    const s = settingsRef.current;
    renderComposition(ctx, dims.width, dims.height, s, subject, bgImageFor(s.background));
  }, [dims, compare]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, settings, compare, bgTick, draw]);

  // ---- Fit to screen ------------------------------------------------------
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !dims.width) return;
    const pad = 48;
    const z = Math.min((vp.clientWidth - pad) / dims.width, (vp.clientHeight - pad) / dims.height);
    setZoom(Math.max(0.05, Math.min(z, 4)));
    setPan({ x: 0, y: 0 });
  }, [dims]);

  useEffect(() => {
    if (ready) fit();
  }, [ready, fit]);

  // ---- History ------------------------------------------------------------
  const commit = useCallback(
    (next: EditorSettings, subject?: ImageData) => {
      setHistory((prev) => {
        const base = prev.slice(0, hIndex + 1);
        const entry: HistoryEntry = { settings: next, subject: subject ?? currentSubjectData.current! };
        const out = [...base, entry].slice(-MAX_HISTORY);
        setHIndex(out.length - 1);
        return out;
      });
      if (subject) currentSubjectData.current = subject;
      setSettings(next);
    },
    [hIndex],
  );

  const applyEntry = useCallback((entry: HistoryEntry) => {
    if (entry.subject !== currentSubjectData.current && subjectCanvas.current) {
      subjectCanvas.current.getContext("2d")!.putImageData(entry.subject, 0, 0);
      currentSubjectData.current = entry.subject;
    }
    setSettings(entry.settings);
  }, []);

  const canUndo = hIndex > 0;
  const canRedo = hIndex < history.length - 1;
  const undo = useCallback(() => {
    if (!canUndo) return;
    applyEntry(history[hIndex - 1]);
    setHIndex(hIndex - 1);
  }, [canUndo, history, hIndex, applyEntry]);
  const redo = useCallback(() => {
    if (!canRedo) return;
    applyEntry(history[hIndex + 1]);
    setHIndex(hIndex + 1);
  }, [canRedo, history, hIndex, applyEntry]);

  const reset = () => {
    const initial = history[0];
    if (!initial) return;
    subjectCanvas.current?.getContext("2d")!.putImageData(initial.subject, 0, 0);
    commit(DEFAULT_SETTINGS, initial.subject);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Live update (while dragging a slider) and commit (on release).
  const live = (patch: Partial<EditorSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const commitCurrent = () => commit(settingsRef.current);
  const change = (patch: Partial<EditorSettings>) => commit({ ...settingsRef.current, ...patch });

  // ---- Pointer interactions ----------------------------------------------
  const drag = useRef<{ mode: Tool; startX: number; startY: number; orig: { x: number; y: number }; last?: { x: number; y: number } } | null>(null);

  const toComposition = (clientX: number, clientY: number) => {
    const rect = displayCanvas.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * dims.width,
      y: ((clientY - rect.top) / rect.height) * dims.height,
      perPx: dims.width / rect.width,
    };
  };

  const paintAt = (cx: number, cy: number) => {
    const sc = subjectCanvas.current;
    if (!sc) return;
    const s = settingsRef.current;
    const p = compositionToSubject(cx, cy, dims.width, dims.height, s);
    const r = brushSize / 2 / s.scale;
    const ctx = sc.getContext("2d")!;
    if (tool === "erase") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (tool === "restore" && originalCanvas.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalCanvas.current, 0, 0);
      ctx.restore();
    }
  };

  const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, brushSize / 4);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      paintAt(from.x + ((to.x - from.x) * i) / n, from.y + ((to.y - from.y) * i) / n);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready || compare) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const mode: Tool = e.button === 1 ? "pan" : tool;
    if (mode === "erase" || mode === "restore") {
      const p = toComposition(e.clientX, e.clientY);
      paintAt(p.x, p.y);
      draw();
      drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { x: 0, y: 0 }, last: { x: p.x, y: p.y } };
    } else if (mode === "move") {
      drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { x: settingsRef.current.offsetX, y: settingsRef.current.offsetY } };
    } else {
      drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...pan } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (displayCanvas.current && (tool === "erase" || tool === "restore")) {
      const vp = viewportRef.current!.getBoundingClientRect();
      setCursor({ x: e.clientX - vp.left, y: e.clientY - vp.top });
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === "erase" || d.mode === "restore") {
      const p = toComposition(e.clientX, e.clientY);
      if (d.last) paintLine(d.last, p);
      d.last = { x: p.x, y: p.y };
      draw();
    } else if (d.mode === "move") {
      const { perPx } = toComposition(e.clientX, e.clientY);
      live({ offsetX: d.orig.x + (e.clientX - d.startX) * perPx, offsetY: d.orig.y + (e.clientY - d.startY) * perPx });
    } else {
      setPan({ x: d.orig.x + (e.clientX - d.startX), y: d.orig.y + (e.clientY - d.startY) });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "erase" || d.mode === "restore") {
      const sc = subjectCanvas.current!;
      commit(settingsRef.current, sc.getContext("2d")!.getImageData(0, 0, sc.width, sc.height));
    } else if (d.mode === "move") {
      commitCurrent();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    setZoom((z) => Math.min(8, Math.max(0.05, z * factor)));
  };

  // ---- Export -------------------------------------------------------------
  const renderExport = (outW: number, outH: number, opaque: boolean) => {
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d")!;
    const s = settingsRef.current;
    if (opaque && s.background.kind === "transparent") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.scale(outW / dims.width, outH / dims.height);
    renderComposition(ctx, dims.width, dims.height, s, subjectCanvas.current!, bgImageFor(s.background), outW / dims.width);
    return c;
  };

  const isBrush = tool === "erase" || tool === "restore";
  const brushScreen = brushSize * zoom;
  const name = useMemo(() => baseName(filename), [filename]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" onClick={onStartOver}>Start over</Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col lg:h-[calc(100vh-4rem)] lg:flex-row">
        {/* Tools sidebar */}
        <aside className="order-2 border-t border-border bg-card lg:order-1 lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-t-0">
          <Tabs defaultValue="background" className="p-4 sm:p-5">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="background" className="gap-1.5"><Palette className="h-3.5 w-3.5" /> Background</TabsTrigger>
              <TabsTrigger value="adjust" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust</TabsTrigger>
              <TabsTrigger value="brush" className="gap-1.5" onClick={() => !isBrush && setTool("erase")}><Paintbrush className="h-3.5 w-3.5" /> Brush</TabsTrigger>
            </TabsList>

            <TabsContent value="background" className="mt-5">
              <BackgroundSelector
                value={settings.background}
                onChange={(b) => change({ background: b })}
                customImages={customImages}
                onAddCustomImage={(img) => setCustomImages((c) => [img, ...c])}
              />
              <div className={cn("mt-6", settings.background.kind !== "image" && "opacity-50")}>
                <SliderRow
                  label="Background blur"
                  value={settings.bgBlur}
                  min={0}
                  max={20}
                  step={1}
                  disabled={settings.background.kind !== "image"}
                  format={(v) => (v === 0 ? "Off" : String(v))}
                  onChange={(v) => live({ bgBlur: v })}
                  onCommit={commitCurrent}
                />
              </div>
            </TabsContent>

            <TabsContent value="adjust" className="mt-5 space-y-5">
              <SliderRow label="Brightness" value={settings.brightness} min={0} max={200} step={1} format={(v) => `${v}%`} onChange={(v) => live({ brightness: v })} onCommit={commitCurrent} />
              <SliderRow label="Contrast" value={settings.contrast} min={0} max={200} step={1} format={(v) => `${v}%`} onChange={(v) => live({ contrast: v })} onCommit={commitCurrent} />
              <SliderRow label="Saturation" value={settings.saturation} min={0} max={200} step={1} format={(v) => `${v}%`} onChange={(v) => live({ saturation: v })} onCommit={commitCurrent} />
              <div className="h-px bg-border" />
              <SliderRow label="Scale" value={Math.round(settings.scale * 100)} min={10} max={300} step={1} format={(v) => `${v}%`} onChange={(v) => live({ scale: v / 100 })} onCommit={commitCurrent} />
              <SliderRow label="Rotation" value={settings.rotation} min={-180} max={180} step={1} format={(v) => `${v}°`} onChange={(v) => live({ rotation: v })} onCommit={commitCurrent} />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => change({ brightness: 100, contrast: 100, saturation: 100, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 })}
              >
                <RotateCcw /> Reset adjustments
              </Button>
            </TabsContent>

            <TabsContent value="brush" className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <ToolCard active={tool === "erase"} onClick={() => setTool("erase")} icon={<Eraser className="h-5 w-5" />} title="Erase" text="Remove leftover background" />
                <ToolCard active={tool === "restore"} onClick={() => setTool("restore")} icon={<Paintbrush className="h-5 w-5" />} title="Restore" text="Paint back the original" />
              </div>
              <SliderRow label="Brush size" value={brushSize} min={4} max={250} step={1} format={(v) => `${v}px`} onChange={setBrushSize} />
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Paint over the image to erase or restore. Restore copies pixels from your original photo, so it lines up best when the AI kept the subject in place.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}><Undo2 /> Undo</Button>
                <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}><Redo2 /> Redo</Button>
                <Button variant="outline" size="sm" onClick={reset}><RotateCcw /> Reset</Button>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas area */}
        <section className="order-1 flex min-h-[60vh] flex-1 flex-col lg:order-2 lg:min-h-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
            <div className="mr-auto min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{filename}</p>
              <p className="text-xs text-muted-foreground">{dims.width ? `${dims.width}×${dims.height}` : "Loading…"}</p>
            </div>
            <IconBtn label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}><Undo2 /></IconBtn>
            <IconBtn label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}><Redo2 /></IconBtn>
            <IconBtn label="Reset all edits" onClick={reset}><RotateCcw /></IconBtn>
            <Button
              variant={compare ? "secondary" : "outline"}
              size="sm"
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setCompare(true)}
              onKeyUp={() => setCompare(false)}
              title="Hold to see the original"
            >
              <Eye /> <span className="hidden sm:inline">Hold to compare</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onStartOver}>
              <ImagePlus /> <span className="hidden sm:inline">New image</span>
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)} disabled={!ready} className="bg-brand-gradient shadow-brand">
              <Download /> Download
            </Button>
          </div>

          <div
            ref={viewportRef}
            className={cn(
              "relative flex-1 overflow-hidden bg-muted touch-none",
              tool === "pan" && "cursor-grab",
              tool === "move" && "cursor-move",
              isBrush && "cursor-none",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setCursor(null)}
            onWheel={onWheel}
          >
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <div
              className="absolute left-1/2 top-1/2 shadow-soft"
              style={{
                width: dims.width * zoom,
                height: dims.height * zoom,
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                visibility: ready ? "visible" : "hidden",
              }}
            >
              <div className="absolute inset-0 bg-checker" />
              <canvas ref={displayCanvas} width={dims.width || 1} height={dims.height || 1} className="relative block h-full w-full" />
              {compare && (
                <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-soft">Original</span>
              )}
            </div>

            {isBrush && cursor && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-card shadow-[0_0_0_1px_var(--color-foreground)]"
                style={{ width: brushScreen, height: brushScreen, left: cursor.x - brushScreen / 2, top: cursor.y - brushScreen / 2 }}
              />
            )}

            {/* Floating toolbar */}
            <div
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-soft backdrop-blur"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ToolBtn label="Move subject" active={tool === "move"} onClick={() => setTool("move")}><Move /></ToolBtn>
              <ToolBtn label="Pan view" active={tool === "pan"} onClick={() => setTool("pan")}><Hand /></ToolBtn>
              <ToolBtn label="Erase brush" active={tool === "erase"} onClick={() => setTool("erase")}><Eraser /></ToolBtn>
              <ToolBtn label="Restore brush" active={tool === "restore"} onClick={() => setTool("restore")}><Paintbrush /></ToolBtn>
              <span className="mx-1 h-5 w-px bg-border" />
              <ToolBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(0.05, z / 1.25))}><ZoomOut /></ToolBtn>
              <span className="w-11 text-center text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <ToolBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}><ZoomIn /></ToolBtn>
              <ToolBtn label="Fit to screen" onClick={fit}><Maximize /></ToolBtn>
            </div>
          </div>
        </section>
      </div>

      {ready && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          editorSize={dims}
          originalSize={originalSize}
          isTransparent={settings.background.kind === "transparent"}
          filenameBase={name}
          render={renderExport}
        />
      )}
    </TooltipProvider>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange, onCommit, disabled }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={() => onCommit?.()}
        aria-label={label}
      />
    </div>
  );
}

function ToolCard({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border border-border p-3 text-left transition-colors",
        active ? "border-primary bg-secondary text-secondary-foreground" : "hover:bg-muted",
      )}
    >
      <div className={cn("mb-2", active ? "text-primary" : "text-muted-foreground")}>{icon}</div>
      <div className="text-sm font-bold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{text}</div>
    </button>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:h-4 [&_svg]:w-4",
            active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
