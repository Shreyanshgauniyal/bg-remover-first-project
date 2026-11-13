import { useEffect, useMemo, useState } from "react";
import { Download, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { supportsWebpExport } from "@/lib/pixelcut/editor";
import { triggerDownload } from "@/lib/pixelcut/projects";

export type ExportFormat = "png" | "jpg" | "webp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorSize: { width: number; height: number };
  originalSize: { width: number; height: number } | null;
  isTransparent: boolean;
  filenameBase: string;
  render: (width: number, height: number, opaque: boolean) => HTMLCanvasElement;
}

const MIME: Record<ExportFormat, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export function ExportDialog({ open, onOpenChange, editorSize, originalSize, isTransparent, filenameBase, render }: Props) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState<"standard" | "high">("high");
  const [sizeMode, setSizeMode] = useState<"original" | "editor" | "custom">(originalSize ? "original" : "editor");
  const [customWidth, setCustomWidth] = useState(editorSize.width);
  const [busy, setBusy] = useState(false);
  const webpOk = useMemo(() => supportsWebpExport(), []);
  const aspect = editorSize.height / editorSize.width;

  useEffect(() => {
    if (open) setCustomWidth(editorSize.width);
  }, [open, editorSize.width]);

  const target = (() => {
    if (sizeMode === "original" && originalSize) return originalSize;
    if (sizeMode === "custom") {
      const w = Math.min(Math.max(Math.round(customWidth) || 0, 16), 6000);
      return { width: w, height: Math.max(1, Math.round(w * aspect)) };
    }
    return editorSize;
  })();

  const download = async () => {
    setBusy(true);
    try {
      const canvas = render(target.width, target.height, format === "jpg");
      const q = format === "png" ? undefined : quality === "high" ? 0.95 : 0.82;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME[format], q));
      if (!blob) throw new Error("Export failed");
      triggerDownload(blob, `${filenameBase}-pixelcut.${format}`);
      toast.success(`Downloaded ${format.toUpperCase()} · ${target.width}×${target.height}`);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't export the image. Try a smaller size.");
    } finally {
      setBusy(false);
    }
  };

  const formats: { id: ExportFormat; label: string; note: string; disabled?: boolean }[] = [
    { id: "png", label: "PNG", note: isTransparent ? "Keeps transparency" : "Lossless" },
    { id: "jpg", label: "JPG", note: isTransparent ? "White background" : "Smaller file" },
    { id: "webp", label: "WEBP", note: webpOk ? "Small, keeps transparency" : "Not supported in this browser", disabled: !webpOk },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download image</DialogTitle>
          <DialogDescription>Exports exactly what you see in the editor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.disabled}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "rounded-xl border border-border p-3 text-left transition-colors disabled:opacity-40",
                    format === f.id ? "border-primary bg-secondary" : "hover:bg-muted",
                  )}
                >
                  <div className="text-sm font-bold text-foreground">{f.label}</div>
                  <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{f.note}</div>
                </button>
              ))}
            </div>
          </div>

          {format !== "png" && (
            <div>
              <Label className="mb-2 block">Quality</Label>
              <RadioGroup value={quality} onValueChange={(v) => setQuality(v as "standard" | "high")} className="flex gap-5">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="standard" /> Standard</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="high" /> High</label>
              </RadioGroup>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Size</Label>
            <RadioGroup value={sizeMode} onValueChange={(v) => setSizeMode(v as typeof sizeMode)} className="space-y-2">
              {originalSize && (
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="original" /> Original size
                  <span className="text-muted-foreground">{originalSize.width}×{originalSize.height}</span>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="editor" /> AI result size
                <span className="text-muted-foreground">{editorSize.width}×{editorSize.height}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="custom" /> Custom width
              </label>
            </RadioGroup>
            {sizeMode === "custom" && (
              <div className="mt-2 flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={16}
                  max={6000}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-28"
                  aria-label="Custom width in pixels"
                />
                <span className="text-sm text-muted-foreground">× {target.height} px</span>
              </div>
            )}
            {target.width > editorSize.width * 1.05 && (
              <p className="mt-3 flex gap-2 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The AI cut-out is about {editorSize.width}×{editorSize.height}. Larger sizes are scaled up, so they won't add extra detail.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={download} disabled={busy} className="bg-brand-gradient shadow-brand">
            {busy ? <Loader2 className="animate-spin" /> : <Download />} Download {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
