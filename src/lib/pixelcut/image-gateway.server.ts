// Server-only remove.bg integration. The API key is read only on the server.
export function requestBackgroundRemoval(opts: {
  apiKey: string;
  image: File;
}): Promise<Response> {
  const form = new FormData();
  form.set("image_file", opts.image, opts.image.name || "image.png");
  // Preview is supported by the free remove.bg API tier.
  form.set("size", "preview");
  form.set("format", "png");

  return fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": opts.apiKey },
    body: form,
  });
}
