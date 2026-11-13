import { Outlet, createRootRouteWithContext, HeadContent, Scripts, useRouter, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useAuth, type AuthState } from "@/hooks/use-auth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { isPixelcutPath } from "@/lib/pixelcut/paths";
import { useEffect } from "react";

import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

interface RouterContext {
  auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    // Allow the public UI to render before the owner connects Supabase.
    // Authentication and database-backed features remain unavailable until configured.
    const session = isSupabaseConfigured()
      ? (await supabase.auth.getSession()).data.session
      : null;
    return {
      auth: {
        isAuthenticated: !!session,
        user: session?.user ?? null,
        session,
        isLoading: false,
      } as AuthState,
    };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PixelCut AI — Remove backgrounds. Create possibilities." },
      { name: "description", content: "Remove image backgrounds in seconds with AI, then edit and download your picture." },
      { name: "author", content: "PixelCut AI" },
      { property: "og:title", content: "PixelCut AI — Remove backgrounds. Create possibilities." },
      { property: "og:description", content: "Remove image backgrounds in seconds with AI, then edit and download your picture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className={isPixelcutPath(pathname) ? "pixelcut" : undefined}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const router = useRouter();
  const auth = useAuth();

  // When auth state changes, invalidate the router so beforeLoad re-runs
  useEffect(() => {
    router.invalidate();
  }, [auth.isAuthenticated, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
