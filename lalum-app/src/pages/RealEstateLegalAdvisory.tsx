import { useLang } from "../context/LangContext";
import { PillarView } from "../components/PillarView";
import { realEstatePillarFor } from "../lib/pillars";

export function RealEstateLegalAdvisory() {
  const { lang } = useLang();
  return <PillarView P={realEstatePillarFor(lang)} />;
}
