import type { IconName } from "../lib/content";

type Props = { name: IconName | string; size?: number; className?: string };

// References the shared sprite served from /public/icons.svg.
export function Icon({ name, size = 20, className }: Props) {
  return (
    <svg width={size} height={size} className={className} style={{ display: "block" }} aria-hidden="true">
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  );
}
