// The hero backdrop: paragraph rules the width of contract lines, with a soft
// light passing over them and two lines flagged in clay, as if someone marked
// them for review.
//
// It says what the practice does before a word is read: a document being read
// closely, by a machine and by a person. Pure CSS and markup, so it costs no
// script, no canvas and no network.
//
// The line widths are fixed rather than random. A random ragged edge changes
// on every load and reads as noise; these repeat, so the block holds still and
// looks typeset.
const WIDTHS = [96, 88, 93, 74, 90, 84, 97, 62, 91, 86, 79, 94];
const ROWS = 12;
// One flagged line per column, placed apart so the two marks never line up.
const FLAGGED: Record<number, number> = { 0: 4, 1: 8 };

export function ClauseScan() {
  return (
    <>
      <div className="clause-doc">
        {[0, 1].map((col) => (
          <div className="clause-para" key={col}>
            {Array.from({ length: ROWS }, (_, i) => (
              <span
                key={i}
                className={"clause-line" + (FLAGGED[col] === i ? " flagged" : "")}
                style={{ inlineSize: `${WIDTHS[(i * 5 + col * 3) % WIDTHS.length]}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="clause-sweep" />
    </>
  );
}
