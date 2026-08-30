import { useEffect, useRef, useState } from "react";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";

// The hero's second call to action, with a label that rolls through several
// angles on the same offer instead of standing still as one long sentence.
//
// Three rules keep a rotating label from doing harm:
//
//   1. The accessible name never changes. Screen readers announce the fixed
//      `label`; the rolling text is decorative and hidden from them. A name
//      that changes mid-sentence is how this pattern usually breaks.
//   2. It stops when someone is trying to read it: on hover, on keyboard
//      focus, and for anyone who asked for reduced motion.
//   3. The first line is the plain one the site already used, so a visitor who
//      glances once still reads the straightforward version.
//
// Every line occupies the same grid cell, so the button is as wide as the
// longest of them and never changes width while the text rolls.

// Rotation copy exists only where it was written. Any other language renders
// the single label, which is always correct, rather than a machine-made
// variant of a sales line.
const LINES: Record<string, string[]> = {
  // No line runs longer than the first: the button is sized by the longest of
  // them, and a wider button pushes the pair in the hero onto two rows.
  he: [
    "לבחינת התאמת תיק ל-AI & DOM",
    "מתאים לתיק שלכם? בדיקה קצרה",
    "איפה אתם חשופים היום?",
    "מה רלוונטי לתיק שלכם?",
  ],
  en: [
    "See if AI & DOM fit your matter",
    "A short check for your matter",
    "Where are you exposed today?",
    "What applies to your matter?",
  ],
};

const HOLD_MS = 4200;
const SWAP_MS = 520;

export function RotatingCta({ to, label, className = "" }: { to: string; label: string; className?: string }) {
  const { lang } = useLang();
  const lines = LINES[lang];
  const [i, setI] = useState(0);
  const [out, setOut] = useState(-1);
  const paused = useRef(false);

  useEffect(() => {
    if (!lines || lines.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      setI((prev) => {
        setOut(prev);
        return (prev + 1) % lines.length;
      });
      window.setTimeout(() => setOut(-1), SWAP_MS);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [lines]);

  const hold = () => { paused.current = true; };
  const release = () => { paused.current = false; };

  return (
    <Link
      to={to}
      className={"btn btn-outline" + (className ? " " + className : "")}
      aria-label={label}
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      {lines ? (
        <span className="btn-roll" aria-hidden="true">
          {lines.map((text, n) => (
            <span key={text} className={n === i ? "on" : n === out ? "out" : ""}>
              {text}
            </span>
          ))}
        </span>
      ) : (
        label
      )}
    </Link>
  );
}
