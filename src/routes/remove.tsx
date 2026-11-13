import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PixelcutPage } from "@/components/pixelcut/PixelcutPage";
import { UploadZone } from "@/components/pixelcut/UploadZone";
import { ImageEditor } from "@/components/pixelcut/editor/ImageEditor";
import { formatBytes } from "@/lib/pixelcut/files";
import { fileFromUrl, takePendingFile } from "@/lib/pixelcut/pending-file";
import { downloadBlob, getProject, saveProject } from "@/lib/pixelcut/projects";
import { prepareForProcessing, removeBackground, RemovalError } from "@/lib/pixelcut/remove-background";
import { SAMPLES } from "@/lib/pixelcut/samples";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/remove")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Background Remover — PixelCut AI" },
      { name: "description", content: "Upload a photo and remove its background with AI, then edit and download it." },
      { property: "og:title", content: "Background Remover — PixelCut AI" },
      { property: "og:description", content: "Upload a photo and remove its background with AI, then edit and download it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemovePage,
});

type Phase =
  | { kind: "empty" }
  | { kind: "selected" }
  | { kind: "processing"; preview: string | null; final: boolean }
  | { kind: "error"; message: string; status: number }
  | { kind: "editing"; cutoutUrl: string };

function RemovePage() {
  const { auth } = useRouteContext({ from: "__root__" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const [save, setSave] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);

  const choose = (f: File) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setOriginalUrl(url);
    setOriginalSize(null);
    const img = new Image();
    img.onload = () => setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    setPhase({ kind: "selected" });
  };

  useEffect(() => {
    const pending = takePendingFile();
    if (pending) choose(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open a saved project
  useEffect(() => {
    if (!search.project || !auth.user) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getProject(search.project!);
        if (!p) throw new Error("Project not found");
        const [orig, cut] = await Promise.all([downloadBlob(p.original_path), downloadBlob(p.processed_path)]);
        if (cancelled) return;
        const f = new File([orig], p.filename, { type: p.file_type });
        setFile(f);
        setOriginalUrl(URL.createObjectURL(orig));
        setOriginalSize(p.width && p.height ? { width: p.width, height: p.height } : null);
        setPhase({ kind: "editing", cutoutUrl: URL.createObjectURL(cut) });
      } catch {
        if (!cancelled) toast.error("Couldn't open that project.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.project, auth.user]);

  const startOver = () => {
    setFile(null);
    setPhase({ kind: "empty" });
    if (search.project) navigate({ to: "/remove", search: {} });
  };

  const process = async () => {
    if (!file) return;
    setPhase({ kind: "processing", preview: null, final: false });
    setElapsed(0);
    timer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const prepared = await prepareForProcessing(file);
      const { dataUrl, remaining } = await removeBackground({
        image: prepared.blob,
        filename: file.name,
        width: prepared.width,
        height: prepared.height,
        onFrame: (url, isFinal) => setPhase({ kind: "processing", preview: url, final: isFinal }),
      });
      const cutBlob = await (await fetch(dataUrl)).blob();
      const cutoutUrl = URL.createObjectURL(cutBlob);
      setPhase({ kind: "editing", cutoutUrl });
      toast.success(remaining !== null ? `Background removed · ${remaining} free removals left this month` : "Background removed");
      if (save && auth.user) {
        saveProject({
          userId: auth.user.id,
          file,
          cutout: cutBlob,
          width: originalSize?.width ?? prepared.width,
          height: originalSize?.height ?? prepared.height,
        }).then(
          () => toast.success("Saved to My Projects"),
          () => toast.error("Couldn't save to My Projects, but you can still edit and download."),
        );
      }
    } catch (err) {
      const e = err instanceof RemovalError ? err : new RemovalError("Background removal failed. Please try again.", 500);
      setPhase({ kind: "error", message: e.message, status: e.status });
    } finally {
      if (timer.current) window.clearInterval(timer.current);
    }
  };

  if (phase.kind === "editing" && originalUrl && file) {
    return (
      <PixelcutPage footer={false}>
        <ImageEditor originalUrl={originalUrl} cutoutUrl={phase.cutoutUrl} filename={file.name} originalSize={originalSize} onStartOver={startOver} />
      </PixelcutPage>
    );
  }

  return (
    <PixelcutPage>
      <div className="bg-brand-glow">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Background Remover</h1>
            <p className="mt-2 text-muted-foreground">Upload an image and our AI will cut out the subject for you.</p>
          </div>

          {phase.kind === "empty" && (
            <>
              <UploadZone onFile={choose} enablePaste className="mt-10" />
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <span className="text-sm text-muted-foreground">Try a sample:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={async () => choose(await fileFromUrl(s.before, s.filename))}
                    className="h-14 w-14 overflow-hidden rounded-xl border border-border shadow-soft hover:ring-2 hover:ring-primary/40"
                    aria-label={`Use the ${s.label.toLowerCase()} sample`}
                  >
                    <img src={s.before} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          {phase.kind !== "empty" && file && originalUrl && (
            <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-checker">
                <img
                  src={phase.kind === "processing" && phase.preview ? phase.preview : originalUrl}
                  alt={file.name}
                  className={cn(
                    "max-h-full max-w-full object-contain transition-[filter] duration-500",
                    phase.kind === "processing" && phase.preview && !phase.final ? "blur-xl" : "blur-0",
                  )}
                />
                {phase.kind === "processing" && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="animate-scan absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-sm font-semibold text-foreground shadow-soft">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {phase.preview ? "Refining edges…" : "Detecting subject…"} <span className="tabular-nums text-muted-foreground">{elapsed}s</span>
                    </div>
                  </div>
                )}
                {phase.kind === "selected" && (
                  <button onClick={startOver} className="absolute right-3 top-3 rounded-full bg-card/90 p-2 text-muted-foreground shadow-soft hover:text-foreground" aria-label="Remove image">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)}
                    {originalSize && ` · ${originalSize.width}×${originalSize.height}`}
                  </p>
                </div>

                {phase.kind === "selected" && (
                  <div className="flex flex-col items-stretch gap-3 sm:items-end">
                    {auth.user && (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch checked={save} onCheckedChange={setSave} /> Save to My Projects
                      </label>
                    )}
                    <Button size="lg" onClick={process} className="rounded-full bg-brand-gradient shadow-brand">
                      <Sparkles /> Remove Background
                    </Button>
                  </div>
                )}
              </div>

              {phase.kind === "error" && (
                <div className="flex flex-col gap-3 border-t border-border bg-muted/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {phase.message}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={startOver}>Choose another</Button>
                    {phase.status !== 413 && phase.status !== 402 && phase.status !== 403 ? (
                      <Button onClick={process}><RefreshCw /> Try again</Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PixelcutPage>
  );
}
