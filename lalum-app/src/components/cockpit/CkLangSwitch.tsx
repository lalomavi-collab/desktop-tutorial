import { useCkLang, type CkLang } from "../../lib/cockpit/ckLang";
import "../../styles/cockpit-lang.css";

// The language switch of the system: two segments in the top bar of every screen and of the entry gate. Each label is
// written in its own language and script, so it can be found whichever language the screen is in.
const OPTIONS: Array<[CkLang, string, string]> = [["he", "עב", "עברית"], ["en", "EN", "English"]];

export function CkLangSwitch() {
  const { lang, setLang, tx } = useCkLang();
  return (
    <div className="ck-langsw" role="group" aria-label={tx("שפת המערכת", "System language")}>
      {OPTIONS.map(([code, short, full]) => (
        <button key={code} type="button" lang={code} dir={code === "he" ? "rtl" : "ltr"} aria-pressed={lang === code} aria-label={full} title={full} onClick={() => setLang(code)}>
          {short}
        </button>
      ))}
    </div>
  );
}
