import { useForceLightMode } from "@/hooks/use-theme";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function PixelcutPage({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  useForceLightMode();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">{children}</main>
      {footer && <Footer />}
    </div>
  );
}
