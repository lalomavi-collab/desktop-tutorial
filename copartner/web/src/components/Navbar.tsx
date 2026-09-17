import { useState } from "react";
import { BRAND, NAV_LINKS } from "../lib/content";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <a href="#top" className="font-display font-bold tracking-tight text-ink focus-ring">
          {BRAND.name}
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted hover:text-ink transition-colors focus-ring">
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href="#apply"
          className="hidden md:inline-flex items-center rounded-full border border-cyan/40 px-5 py-2 text-xs font-semibold tracking-wide text-ink hover:bg-cyan/10 transition-colors focus-ring"
        >
          APPLY TO LEAD A DOMAIN
        </a>

        <button
          className="md:hidden text-ink focus-ring rounded p-2"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="block w-6 h-0.5 bg-ink mb-1.5" />
          <span className="block w-6 h-0.5 bg-ink mb-1.5" />
          <span className="block w-6 h-0.5 bg-ink" />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-bg px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-base text-muted focus-ring" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a
            href="#apply"
            className="mt-2 inline-flex justify-center rounded-full border border-cyan/40 px-5 py-3 text-sm font-semibold text-ink focus-ring"
            onClick={() => setOpen(false)}
          >
            APPLY TO LEAD A DOMAIN
          </a>
        </div>
      )}
    </header>
  );
}
