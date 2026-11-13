// Pages that belong to the Inspo moodboard app keep its own look.
const MOODBOARD_PREFIXES = ["/moodboard", "/dashboard", "/boards"];

export function isPixelcutPath(pathname: string): boolean {
  return !MOODBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Only allow same-site relative paths as post-login destinations. */
export function safeRedirect(value: unknown, fallback = "/remove"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
