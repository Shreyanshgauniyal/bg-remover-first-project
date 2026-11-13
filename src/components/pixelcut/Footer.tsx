import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Remove backgrounds. Create possibilities. Cut out any subject with AI, then edit and download in seconds.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Product</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/remove" className="hover:text-foreground">Background Remover</Link></li>
            <li><Link to="/projects" className="hover:text-foreground">My Projects</Link></li>
            <li><Link to="/moodboard" className="hover:text-foreground">Inspo moodboards</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Account</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground">Log in</Link></li>
            <li><Link to="/signup" className="hover:text-foreground">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} PixelCut AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
