// Ambient, video-like hero backdrop built entirely in CSS: slow drifting warm
// light blobs, a fine film grain, and an ivory scrim that keeps overlaid text
// readable. No media file, no network, and it freezes under
// prefers-reduced-motion. Sits behind hero content (give the content
// position:relative and a z-index so it stacks above this layer).
export function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient-blob ambient-b1" />
      <span className="ambient-blob ambient-b2" />
      <span className="ambient-blob ambient-b3" />
      <span className="ambient-grain" />
      <span className="ambient-scrim" />
    </div>
  );
}
