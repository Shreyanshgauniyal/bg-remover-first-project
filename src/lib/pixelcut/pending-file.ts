// Hands a chosen file from one page (e.g. the home page) to the workspace.
let pending: File | null = null;

export function setPendingFile(file: File) {
  pending = file;
}

export function takePendingFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}

export async function fileFromUrl(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
