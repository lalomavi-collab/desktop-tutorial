import { useLang } from "../context/LangContext";
import { PillarView } from "../components/PillarView";
import { mediationPillarFor } from "../lib/pillars";

export function MediationDisputeResolution() {
  const { lang } = useLang();
  return <PillarView P={mediationPillarFor(lang)} />;
}
