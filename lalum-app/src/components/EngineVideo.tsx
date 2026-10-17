import { LoopVideo } from "./LoopVideo";
import { useLang } from "../context/LangContext";

/** The Engine section's clip (public/media/lalum-engine.mp4): one document
 *  through intake, classification, risk flag, a lawyer's decision and the
 *  record. The on-screen words are Hebrew; the description is in the page's language. */
export function EngineVideo() {
  const { t } = useLang();
  return <LoopVideo src="/media/lalum-engine.mp4" poster="/media/lalum-engine.jpg" className="engine-video" label={t.home.engineVideoAlt} />;
}
