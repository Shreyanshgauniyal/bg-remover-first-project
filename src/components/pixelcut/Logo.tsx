import { Link } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 font-bold tracking-tight text-foreground", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground shadow-brand">
        <Scissors className="h-4 w-4" />
      </span>
      <span className="text-lg">
        PixelCut <span className="text-brand-gradient">AI</span>
      </span>
    </Link>
  );
}
