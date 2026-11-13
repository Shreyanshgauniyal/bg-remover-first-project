import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTRIBUTE, validateImageFile } from "@/lib/pixelcut/files";

interface Props {
  onFile: (file: File) => void;
  /** Listen for images pasted anywhere on the page. */
  enablePaste?: boolean;
  size?: "lg" | "md";
  className?: string;
}

export function UploadZone({ onFile, enablePaste = false, size = "lg", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return;
      const file = list[0];
      const check = validateImageFile(file);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  useEffect(() => {
    if (!enablePaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        const f = files[0];
        const named = f.name && f.name !== "image.png" ? f : new File([f], `pasted-image.${f.type.split("/")[1] || "png"}`, { type: f.type });
        accept([named]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enablePaste, accept]);

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload an image"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/25 bg-card text-center shadow-soft outline-none transition-all duration-200",
          "hover:border-primary/50 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "scale-[1.01] border-primary bg-secondary/60",
          size === "lg" ? "px-6 py-14 sm:py-16" : "px-6 py-10",
        )}
      >
        <div
          className={cn(
            "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-brand transition-transform duration-200 group-hover:-translate-y-0.5",
            dragging && "scale-110",
          )}
        >
          {dragging ? <ImageUp className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
        </div>
        <Button
          type="button"
          size="lg"
          className="pointer-events-none rounded-full bg-brand-gradient px-8 shadow-brand"
          tabIndex={-1}
        >
          Upload Image
        </Button>
        <p className="mt-4 text-sm font-medium text-foreground">
          {dragging ? "Drop your image here" : "or drag and drop a file"}
          {enablePaste && !dragging && <span className="text-muted-foreground"> · paste with Ctrl/⌘ + V</span>}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG, JPEG or WEBP · up to 20 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
}
