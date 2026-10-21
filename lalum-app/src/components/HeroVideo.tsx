import { useLang } from "../context/LangContext";
import { LoopVideo } from "./LoopVideo";

/**
 * The home hero's silent loop on Legal AI. Decorative.
 * Hebrew visitors get the Hebrew clip (public/media/lalum-hero.mp4); every other language gets
 * the English one (lalum-hero.en.mp4), because the on-screen clause, captions and name are
 * drawn into the video and a Hebrew clip is unreadable to them. Both come from
 * scripts/hero-video.mjs (HERO_LANG=en for the English one).
 */
export function HeroVideo() {
  const { lang } = useLang();
  const suffix = lang === "he" ? "" : ".en";
  return (
    <LoopVideo
      key={suffix}
      src={`/media/lalum-hero${suffix}.mp4`}
      poster={`/media/lalum-hero${suffix}.jpg`}
      className="founder-hero hero-video"
    />
  );
}
