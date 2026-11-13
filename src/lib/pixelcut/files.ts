// Upload rules and sizing shared by the browser and the server.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");

/** Longest edge sent to the AI; larger photos are scaled down first. */
export const PROCESSING_MAX_EDGE = 1536;
/** Approximate pixel budget for the AI result (about one megapixel). */
export const RESULT_PIXEL_TARGET = 1024 * 1024;

export type FileCheck =
  | { ok: true }
  | { ok: false; status: 400 | 413; error: string };

export function validateImageFile(file: { name: string; type: string; size: number }): FileCheck {
  const name = file.name.toLowerCase();
  const typeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk && !extOk) {
    return { ok: false, status: 400, error: "Unsupported file. Please use a PNG, JPG, JPEG or WEBP image." };
  }
  if (file.type && !typeOk) {
    return { ok: false, status: 400, error: "Unsupported file. Please use a PNG, JPG, JPEG or WEBP image." };
  }
  if (file.size <= 0) {
    return { ok: false, status: 400, error: "This file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "This image is larger than 20 MB. Please choose a smaller file." };
  }
  return { ok: true };
}

/**
 * Pick an AI output size that keeps the photo's shape: both edges are
 * multiples of 16, the ratio stays between 1:3 and 3:1, and the area is
 * roughly RESULT_PIXEL_TARGET.
 */
export function resultSizeFor(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1024, height: 1024 };
  const ratio = Math.min(Math.max(width / height, 1 / 3), 3);
  const round16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  let w = round16(Math.sqrt(RESULT_PIXEL_TARGET * ratio));
  let h = round16(w / ratio);
  // Stay above the provider's minimum pixel count.
  while (w * h < 655_360) {
    w += 16;
    h = round16(w / ratio);
  }
  return { width: w, height: h };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeLabel(mime: string, name = ""): string {
  if (mime === "image/png" || name.toLowerCase().endsWith(".png")) return "PNG";
  if (mime === "image/webp" || name.toLowerCase().endsWith(".webp")) return "WEBP";
  return "JPG";
}

export function baseName(filename: string): string {
  const i = filename.lastIndexOf(".");
  return (i > 0 ? filename.slice(0, i) : filename).replace(/[^\w\- ]+/g, "").trim() || "image";
}
