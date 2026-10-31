import { useSyncExternalStore } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { DEFAULT_PREFS, SIZE_STEPS, SIZE_STEPS_EN, useCkPrefs, type CkPrefs } from "../../lib/cockpit/ckPrefs";
import { LOOKS, useCkLook } from "../../lib/cockpit/useCkLook";
import { LOOK_EN, useCkLang, type CkLang } from "../../lib/cockpit/ckLang";

// The personal preferences screen (owner, 31.10.2026, from the competitor scan): the choices that make the system comfortable
// to read, in one place and in short cards. Text size, look, language, contrast and motion. Nothing here reaches the server:
// each choice belongs to this browser, as the look and the language already did. The rules live in lib/cockpit/ckPrefs.ts.

const GLYPH = [14, 16, 19, 22, 26];
const LANGS: Array<[CkLang, string]> = [["he", "עברית"], ["en", "English"]];

// Whether the device itself asks for reduced motion; the screen says so beside the switch.
const CALM = "(prefers-reduced-motion: reduce)";
const onCalmChange = (cb: () => void) => { const q = window.matchMedia?.(CALM); q?.addEventListener("change", cb); return () => q?.removeEventListener("change", cb); };
const useDeviceReducesMotion = (): boolean => useSyncExternalStore(onCalmChange, () => window.matchMedia?.(CALM).matches ?? false, () => false);

function Panel() {
  const [prefs, setPrefs] = useCkPrefs();
  const [look, setLook] = useCkLook();
  const { lang, setLang, tx } = useCkLang();
  const deviceCalm = useDeviceReducesMotion();
  const en = lang === "en";
  const put = (patch: Partial<CkPrefs>) => setPrefs({ ...prefs, ...patch });
  const untouched = prefs.size === DEFAULT_PREFS.size && !prefs.contrast && !prefs.motion && look === "beige";
  const reset = () => { setPrefs(DEFAULT_PREFS); setLook("beige"); };

  return (
    <div className="ck-prefs">
      <section className="ck-card ck-prefs-card" aria-labelledby="pf-size">
        <header>
          <h2 id="pf-size">{tx("גודל הטקסט", "Text size")}</h2>
          <p>{tx("התוכן של כל מסך גדל או קטן מיד. הסרגל בצד נשאר באותו גודל.", "The content of every screen grows or shrinks at once. The rail keeps its size.")}</p>
        </header>
        <div className="ck-prefs-seg" role="group" aria-labelledby="pf-size">
          {SIZE_STEPS.map((he, i) => (
            <button key={he} type="button" className="ck-prefs-opt" aria-pressed={prefs.size === i} onClick={() => put({ size: i })}>
              <span className="ck-prefs-glyph" style={{ fontSize: GLYPH[i] }} aria-hidden="true">{en ? "A" : "א"}</span>
              <span>{en ? SIZE_STEPS_EN[i] : he}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ck-card ck-prefs-card" aria-labelledby="pf-look">
        <header>
          <h2 id="pf-look">{tx("מראה", "Look")}</h2>
          <p>{tx("שלושה מראות לאותה מערכת. אפשר להחליף גם מהעיגולים שבראש הסרגל.", "Three looks for the same system. The circles at the top of the rail switch them too.")}</p>
        </header>
        <div className="ck-prefs-seg" role="group" aria-labelledby="pf-look">
          {LOOKS.map(([k, he]) => (
            <button key={k} type="button" className="ck-prefs-opt" aria-pressed={look === k} onClick={() => setLook(k)}>
              <span className={`ck-prefs-look ${k}`} aria-hidden="true"><i /><i /><i /></span>
              <span>{en ? LOOK_EN[k] : he}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ck-card ck-prefs-card" aria-labelledby="pf-lang">
        <header>
          <h2 id="pf-lang">{tx("שפה", "Language")}</h2>
          <p>{tx("שפת המערכת והאתר. אותה בחירה נמצאת גם בראש כל מסך.", "The language of the system and the site. The same choice sits at the top of every screen.")}</p>
        </header>
        <div className="ck-prefs-seg" role="group" aria-labelledby="pf-lang">
          {LANGS.map(([code, label]) => (
            <button key={code} type="button" className="ck-prefs-opt" lang={code} dir={code === "he" ? "rtl" : "ltr"} aria-pressed={lang === code} onClick={() => setLang(code)}>
              <span className="ck-prefs-glyph" style={{ fontSize: 20 }} aria-hidden="true">{code === "he" ? "עב" : "EN"}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ck-card ck-prefs-card" aria-labelledby="pf-access">
        <header>
          <h2 id="pf-access">{tx("נוחות קריאה", "Reading comfort")}</h2>
        </header>
        <div className="ck-prefs-row">
          <div>
            <b id="pf-contrast">{tx("ניגודיות גבוהה", "High contrast")}</b>
            <p className="ck-prefs-note">{tx("טקסט משני כהה יותר, קווים ברורים יותר ומסגרת מיקוד עבה.", "Darker secondary text, firmer lines and a thicker focus ring.")}</p>
          </div>
          <button type="button" role="switch" className="ck-prefs-switch" aria-checked={prefs.contrast} aria-labelledby="pf-contrast" onClick={() => put({ contrast: !prefs.contrast })} />
        </div>
        <div className="ck-prefs-row">
          <div>
            <b id="pf-motion">{tx("הפחתת תנועה", "Reduce motion")}</b>
            <p className="ck-prefs-note">
              {tx("בלי אנימציות ובלי מעברים במסכים.", "No animations and no transitions on the screens.")}
              {deviceCalm && <> {tx("המכשיר כבר מבקש תנועה מופחתת, והמערכת מכבדת זאת גם בלי הבחירה הזו.", "The device already asks for reduced motion, and the system honours it without this choice too.")}</>}
            </p>
          </div>
          <button type="button" role="switch" className="ck-prefs-switch" aria-checked={prefs.motion} aria-labelledby="pf-motion" onClick={() => put({ motion: !prefs.motion })} />
        </div>
      </section>

      <div className="ck-prefs-foot">
        <button type="button" className="ck-btn" disabled={untouched} onClick={reset}>{tx("חזרה לברירת המחדל", "Back to the defaults")}</button>
        <p className="ck-prefs-note">{tx("הבחירות נשמרות בדפדפן הזה בלבד ואינן עוברות למכשיר אחר. השפה אינה מתאפסת.", "The choices are kept in this browser only and do not move to another device. The language is not reset.")}</p>
      </div>
    </div>
  );
}

export function Preferences() {
  return (
    <CockpitFrame title="העדפות תצוגה" description="גודל הטקסט, המראה, השפה, ניגודיות ותנועה. כל בחירה חלה מיד ונשמרת בדפדפן הזה." path="/settings/preferences" needsFirm={false} mfa={false}>
      {() => <Panel />}
    </CockpitFrame>
  );
}
