import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";

// Opt-in marketing consent, per the Israeli Communications Law (spam law):
// unchecked by default, optional (never a condition of submitting), with links
// to the terms and privacy policy.
export function MarketingConsent({ checked, onChange, dark }: { checked: boolean; onChange: (v: boolean) => void; dark?: boolean }) {
  const c = useLang().t.ui.consent;
  return (
    <label className={"consent" + (dark ? " consent-dark" : "")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="consent-text">
        {c.pre}
        <Link to="/legal#terms" target="_blank" rel="noopener noreferrer">{c.terms}</Link>
        {c.mid}
        <Link to="/legal#privacy" target="_blank" rel="noopener noreferrer">{c.privacy}</Link>
        {c.post}
      </span>
    </label>
  );
}
