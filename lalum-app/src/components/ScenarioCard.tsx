import { useLang } from "../context/LangContext";
import type { Testimonial } from "../lib/content";

// Renders one anonymous engagement scenario (sector, challenge, what we did,
// outcome). Shared by the home page and the advisory page so the trust proof
// stays identical in both places.
const LABELS = {
  he: { challenge: "האתגר", work: "מה עשינו", outcome: "התוצאה" },
  en: { challenge: "The challenge", work: "What we did", outcome: "The outcome" },
  es: { challenge: "El desafío", work: "Qué hicimos", outcome: "El resultado" },
  fr: { challenge: "Le défi", work: "Ce que nous avons fait", outcome: "Le résultat" },
  ar: { challenge: "التحدي", work: "ما قمنا به", outcome: "النتيجة" },
} as const;

export function ScenarioCard({ s }: { s: Testimonial }) {
  const { lang } = useLang();
  const L = LABELS[lang];
  const rows = [
    { label: L.challenge, text: s.challenge },
    { label: L.work, text: s.work },
    { label: L.outcome, text: s.outcome },
  ];
  return (
    <div className="card scenario-card">
      <p className="eyebrow" style={{ color: "var(--clay)", margin: "0 0 14px" }}>{s.sector}</p>
      <dl className="scenario-rows">
        {rows.map((r) => (
          <div key={r.label} className="scenario-row">
            <dt className="scenario-label">{r.label}</dt>
            <dd className="scenario-text">{r.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
