import { acct } from "../../lib/cockpit/accounting";

/** One accounting figure: digits left to right and aligned, the minus in red, a zero in grey, the shekel sign small beside it (omit with bare when the column header carries it). */
export function Amt({ n, plus, bare }: { n: number | null | undefined; plus?: boolean; bare?: boolean }) {
  const a = acct(n);
  const sign = a.neg ? "−" : plus && !a.zero ? "+" : "";
  return (
    <span className={`acct${a.neg ? " neg" : ""}${a.zero ? " zero" : ""}`} dir="ltr">
      {sign}{a.text}{!bare && <small>₪</small>}
    </span>
  );
}
