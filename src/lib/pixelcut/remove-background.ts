import { PROCESSING_MAX_EDGE } from "./files";

export class RemovalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function errorFrom(res: Response): Promise<RemovalError> {
  let message = "Background removal failed. Please try again.";
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Keep the fallback message for non-JSON responses.
  }
  return new RemovalError(message, res.status);
}

/** Scale large photos down before sending them, keeping their shape. */
export async function prepareForProcessing(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, PROCESSING_MAX_EDGE / Math.max(width, height));
  if (scale === 1 && file.size < 8 * 1024 * 1024) {
    bitmap.close();
    return { blob: file, width, height };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare this image.");
  }
  context.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not prepare image"))), type, 0.92),
  );
  return { blob, width: w, height: h };
}

/** Sends the image to our backend and receives the finished transparent PNG. */
export async function removeBackground(opts: {
  image: Blob;
  filename: string;
  width: number;
  height: number;
  onFrame: (dataUrl: string, isFinal: boolean) => void;
}): Promise<{ dataUrl: string; remaining: number | null }> {
  const form = new FormData();
  const ext = opts.image.type === "image/jpeg" ? "jpg" : opts.image.type === "image/webp" ? "webp" : "png";
  form.set("image", opts.image, opts.filename || `upload.${ext}`);
  form.set("width", String(opts.width));
  form.set("height", String(opts.height));

  let res: Response;
  try {
    res = await fetch("/api/remove-background", {
      method: "POST",
      body: form,
    });
  } catch {
    throw new RemovalError("Couldn't connect to the server. Check your internet connection and try again.", 0);
  }

  if (!res.ok) throw await errorFrom(res);
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("image/")) {
    throw new RemovalError("The image service returned an unexpected response. Please try again.", 502);
  }

  const blob = await res.blob();
  if (!blob.size) throw new RemovalError("The image service returned an empty image.", 502);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the processed image."));
    reader.readAsDataURL(blob);
  });
  opts.onFrame(dataUrl, true);
  const remainingHeader = res.headers.get("X-PixelCut-Remaining");
  const parsedRemaining = remainingHeader === null ? null : Number(remainingHeader);
  return { dataUrl, remaining: parsedRemaining !== null && Number.isFinite(parsedRemaining) ? parsedRemaining : null };
}
