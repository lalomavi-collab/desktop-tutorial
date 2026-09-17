import { BRAND, NAV_LINKS } from "../lib/content";

export default function Footer() {
  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          <div>
            <p className="font-display font-bold text-ink">{BRAND.name}</p>
            <p className="mt-1 text-sm text-muted">{BRAND.descriptor}</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted hover:text-ink transition-colors focus-ring">{l.label}</a>
            ))}
            <a href="#apply" className="text-sm text-muted hover:text-ink transition-colors focus-ring">Apply</a>
          </nav>

          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            <a href="/privacy" className="text-sm text-muted hover:text-ink transition-colors focus-ring">Privacy</a>
            <a href="/terms" className="text-sm text-muted hover:text-ink transition-colors focus-ring">Terms</a>
            <a href="/confidentiality" className="text-sm text-muted hover:text-ink transition-colors focus-ring">Confidentiality</a>
          </nav>
        </div>

        <p className="mt-12 text-center text-xs text-muted whitespace-pre-line tracking-wide">
          {"EXPERTISE IS HUMAN.\nINFRASTRUCTURE IS INTELLIGENT.\nJUDGMENT REMAINS YOURS."}
        </p>
        <p className="mt-6 text-center text-xs text-muted/60">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
