import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, ImagePlus, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PixelcutPage } from "@/components/pixelcut/PixelcutPage";
import { baseName, fileTypeLabel } from "@/lib/pixelcut/files";
import { deleteProject, downloadBlob, getMyUsage, listProjects, triggerDownload, type ProjectWithThumb } from "@/lib/pixelcut/projects";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "My Projects — PixelCut AI" },
      { name: "description", content: "Your saved background removals." },
      { property: "og:title", content: "My Projects — PixelCut AI" },
      { property: "og:description", content: "Your saved background removals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [type, setType] = useState<"all" | "PNG" | "JPG" | "WEBP">("all");

  const projects = useQuery({ queryKey: ["pixelcut-projects"], queryFn: listProjects });
  const usage = useQuery({ queryKey: ["pixelcut-usage"], queryFn: getMyUsage });

  const remove = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["pixelcut-projects"] });
    },
    onError: () => toast.error("Couldn't delete that project."),
  });

  const visible = useMemo(() => {
    let list = projects.data ?? [];
    if (query.trim()) list = list.filter((p) => p.filename.toLowerCase().includes(query.trim().toLowerCase()));
    if (type !== "all") list = list.filter((p) => fileTypeLabel(p.file_type, p.filename) === type);
    return [...list].sort((a, b) => (sort === "newest" ? -1 : 1) * a.created_at.localeCompare(b.created_at));
  }, [projects.data, query, type, sort]);

  const download = async (p: ProjectWithThumb) => {
    try {
      triggerDownload(await downloadBlob(p.processed_path), `${baseName(p.filename)}-pixelcut.png`);
      toast.success("Downloaded transparent PNG");
    } catch {
      toast.error("Download failed.");
    }
  };

  return (
    <PixelcutPage>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {usage.data
                ? `${usage.data.images_processed} images processed · ${usage.data.remaining} of ${usage.data.monthly_limit} free removals left this month`
                : "Your saved cut-outs"}
            </p>
          </div>
          <Button asChild className="bg-brand-gradient shadow-brand">
            <Link to="/remove"><ImagePlus /> New image</Link>
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by file name" className="pl-9" />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="PNG">PNG</SelectItem>
              <SelectItem value="JPG">JPG</SelectItem>
              <SelectItem value="WEBP">WEBP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {projects.isLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        ) : projects.error ? (
          <p className="mt-10 text-center text-sm text-destructive">Couldn't load your projects.</p>
        ) : visible.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-semibold text-foreground">{projects.data?.length ? "No projects match your filters" : "No projects yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Remove a background and it will be saved here.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <Link to="/remove" search={{ project: p.id }} className="block aspect-square bg-checker">
                  {p.thumbUrl && <img src={p.thumbUrl} alt={p.filename} className="h-full w-full object-contain p-3" loading="lazy" />}
                </Link>
                <div className="p-4">
                  <p className="truncate text-sm font-semibold text-foreground">{p.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileTypeLabel(p.file_type, p.filename)} · {format(new Date(p.created_at), "MMM d, yyyy")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to="/remove" search={{ project: p.id }}><Pencil /> Open</Link>
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => download(p)} aria-label="Download">
                      <Download />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" aria-label="Delete">
                          {remove.isPending && remove.variables?.id === p.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                          <AlertDialogDescription>The original and the cut-out of “{p.filename}” will be permanently deleted.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(p)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PixelcutPage>
  );
}
