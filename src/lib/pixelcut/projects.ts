import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PixelcutProject = Tables<"pixelcut_projects">;
export type ProjectWithThumb = PixelcutProject & { thumbUrl: string | null };

const BUCKET = "pixelcut";

function extFor(mime: string, name: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp)$/);
  return m ? m[1].replace("jpeg", "jpg") : "jpg";
}

export async function saveProject(opts: {
  userId: string;
  file: File;
  cutout: Blob;
  width: number;
  height: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const originalPath = `${opts.userId}/${id}/original.${extFor(opts.file.type, opts.file.name)}`;
  const processedPath = `${opts.userId}/${id}/cutout.png`;

  const up1 = await supabase.storage.from(BUCKET).upload(originalPath, opts.file, { contentType: opts.file.type || undefined });
  if (up1.error) throw up1.error;
  const up2 = await supabase.storage.from(BUCKET).upload(processedPath, opts.cutout, { contentType: "image/png" });
  if (up2.error) {
    await supabase.storage.from(BUCKET).remove([originalPath]);
    throw up2.error;
  }
  const { error } = await supabase.from("pixelcut_projects").insert({
    id,
    user_id: opts.userId,
    filename: opts.file.name,
    file_type: opts.file.type || "image/jpeg",
    file_size: opts.file.size,
    original_path: originalPath,
    processed_path: processedPath,
    width: opts.width,
    height: opts.height,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([originalPath, processedPath]);
    throw error;
  }
  return id;
}

export async function listProjects(): Promise<ProjectWithThumb[]> {
  const { data, error } = await supabase
    .from("pixelcut_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(data.map((p) => p.processed_path), 60 * 60);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return data.map((p) => ({ ...p, thumbUrl: byPath.get(p.processed_path) ?? null }));
}

export async function getProject(id: string): Promise<PixelcutProject | null> {
  const { data, error } = await supabase.from("pixelcut_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function downloadBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Download failed");
  return data;
}

export async function deleteProject(p: PixelcutProject): Promise<void> {
  await supabase.storage.from(BUCKET).remove([p.original_path, p.processed_path]);
  const { error } = await supabase.from("pixelcut_projects").delete().eq("id", p.id);
  if (error) throw error;
}

export type Usage = { images_processed: number; used_this_period: number; monthly_limit: number; remaining: number };

export async function getMyUsage(): Promise<Usage | null> {
  const { data, error } = await supabase.rpc("get_my_pixelcut_usage");
  if (error) throw error;
  return data?.[0] ?? null;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
