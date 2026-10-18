import type { ReactNode } from "react";

// A section inside the hairline frame: crosshairs on the top corners, a
// telemetry strip with a bracketed index and a code, then the body. The frame
// and body follow the page direction (the route sets dir), so Hebrew, Arabic
// and Latin pages all read correctly; only the technical tokens in the strip
// are forced left to right, so brackets and numbers never flip.
//
// `status` is optional and carries no default. The strip is a label, not a
// claim: nothing here says a section is "verified" or "active" unless the
// caller passes that text and can stand behind it.
export function ArchitecturalSection({
  children, index, code, status, id, bare = false, label,
}: {
  children: ReactNode;
  index: string;
  code: string;
  status?: string;
  id?: string;
  /** Drops the body padding when the children bring their own (.wrap .section). */
  bare?: boolean;
  /** Accessible name for the section; the visible strip is decorative. */
  label?: string;
}) {
  return (
    <section id={id} className={"arch" + (bare ? " arch-bare" : "")} aria-label={label}>
      <div className="arch-frame">
        <span className="arch-cross arch-cross-s" aria-hidden="true">+</span>
        <span className="arch-cross arch-cross-e" aria-hidden="true">+</span>
        <div className="arch-strip" aria-hidden="true">
          <div className="arch-strip-l">
            <span dir="ltr" className="mono arch-idx">[{index}]</span>
            <span dir="ltr" className="mono arch-code">{code}</span>
          </div>
          {status ? <span dir="ltr" className="mono arch-status">{status}</span> : null}
        </div>
        <div className="arch-body">{children}</div>
      </div>
    </section>
  );
}
