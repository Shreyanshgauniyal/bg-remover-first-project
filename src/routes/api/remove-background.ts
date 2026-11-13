import { createFileRoute } from "@tanstack/react-router";
import { validateImageFile } from "@/lib/pixelcut/files";
import { requestBackgroundRemoval } from "@/lib/pixelcut/image-gateway.server";

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function upstreamMessage(res: Response): Promise<string | undefined> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string } | string;
      errors?: Array<{ title?: string; detail?: string }>;
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object") return parsed.error.message;
    if (parsed.errors?.length) {
      const first = parsed.errors[0];
      return first.detail ?? first.title;
    }
    return parsed.message;
  } catch {
    return text.slice(0, 300) || undefined;
  }
}

export const Route = createFileRoute("/api/remove-background")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["REMOVE_BG_API_KEY"];
        if (!apiKey) {
          return jsonError(503, "Background removal is not configured. Add REMOVE_BG_API_KEY to your server environment.");
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonError(400, "We couldn't read that upload. Please try again.");
        }
        const image = form.get("image");
        if (!(image instanceof File)) return jsonError(400, "No image was uploaded.");
        const check = validateImageFile(image);
        if (!check.ok) return jsonError(check.status, check.error);

        const width = Number(form.get("width"));
        const height = Number(form.get("height"));
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 20000 || height > 20000) {
          return jsonError(400, "Invalid image dimensions.");
        }

        let upstream: Response;
        try {
          upstream = await requestBackgroundRemoval({ apiKey, image });
        } catch (err) {
          console.error("remove.bg API unreachable", err);
          return jsonError(502, "The AI service couldn't be reached. Please try again in a moment.");
        }

        if (!upstream.ok || !upstream.body) {
          const message = await upstreamMessage(upstream);
          console.error("remove.bg API error", upstream.status, message);
          if (upstream.status === 401 || upstream.status === 403) {
            return jsonError(502, "The remove.bg API key was rejected. Check REMOVE_BG_API_KEY in your server settings.");
          }
          if (upstream.status === 402) {
            return jsonError(402, message ?? "Your remove.bg account has no remaining free API credits.");
          }
          if (upstream.status === 429) return jsonError(429, message ?? "The remove.bg API rate limit was reached. Please wait and try again.");
          if (upstream.status === 400) {
            return jsonError(400, message ?? "This image couldn't be processed. Please try a different image.");
          }
          return jsonError(500, "Background removal failed. Please try again.");
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
