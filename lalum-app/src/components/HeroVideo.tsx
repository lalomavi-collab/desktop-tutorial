import { LoopVideo } from "./LoopVideo";

/** The home hero's silent loop on Legal AI (public/media/lalum-hero.mp4). Decorative. */
export function HeroVideo() {
  return <LoopVideo src="/media/lalum-hero.mp4" poster="/media/lalum-hero.jpg" className="founder-hero hero-video" />;
}
