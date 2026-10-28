import { useLang } from "../context/LangContext";
import { UNREVIEWED_LANGS, type Lang } from "../lib/hreflang";

// One line above the header on a language nobody has reviewed yet (see
// UNREVIEWED_LANGS). The text is kept here rather than in the strings files
// because it exists only for these three languages and goes away with them.
// It reuses the in-app browser band's styling: same place, same weight.
const TEXT: Partial<Record<Lang, string>> = {
  es: "Traducción asistida por máquina, pendiente de revisión. El texto en hebreo es el que prevalece.",
  fr: "Traduction assistée par machine, en cours de relecture. Le texte hébreu fait foi.",
  ar: "ترجمة بمساعدة الآلة، قيد المراجعة. النص العبري هو المعتمد.",
};

export function UnreviewedTranslationNotice() {
  const { lang } = useLang();
  const text = TEXT[lang];
  if (!UNREVIEWED_LANGS.has(lang) || !text) return null;
  return (
    <div className="iab-banner" role="note">
      <p className="iab-banner-text">{text}</p>
    </div>
  );
}
