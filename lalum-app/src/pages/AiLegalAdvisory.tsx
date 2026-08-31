import { useLang } from "../context/LangContext";
import { PillarView } from "../components/PillarView";
import { aiPillarFor } from "../lib/pillars";

export function AiLegalAdvisory() {
  const { lang } = useLang();
  return <PillarView P={aiPillarFor(lang)} />;
}
