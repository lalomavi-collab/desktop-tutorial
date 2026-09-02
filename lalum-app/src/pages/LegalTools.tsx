import { useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { Icon } from "../components/Icon";
import { Diagnostic } from "../components/Diagnostic";
import { pageNode, pageJsonLd } from "../lib/schema";
import { LEGAL_TOOLS, TOOLS_PAGE, type ToolClause, type ToolCompare } from "../lib/legalTools";

// The diagnostic tools on the AI pillar. One page rather than three, because
// the three questions an executive arrives with (are we compliant, is this
// vendor agreement safe, is this dispute worth litigating) are asked in the
// same visit, and three pages would each carry a third of the answer.
//
// Results print through the browser rather than through a PDF library: the
// print stylesheet in index.css hides the page furniture and leaves the result
// card, which produces a clean RTL Hebrew summary with no dependency added and
// nothing sent anywhere.

function Clause({ clause }: { clause: ToolClause }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card" style={{ padding: "22px 20px", background: "var(--clay-tint)", border: "1px solid var(--clay-soft)" }}>
      <h4 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px", color: "var(--ink)" }}>{clause.title}</h4>
      <pre style={{ whiteSpace: "pre-wrap", font: "inherit", fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)", margin: "0 0 16px" }}>{clause.body}</pre>
      <button
        type="button"
        className="btn btn-outline no-print"
        onClick={() => {
          navigator.clipboard?.writeText(clause.body).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
            () => setCopied(false),
          );
        }}
      >
        <Icon name="file" size={16} /> {copied ? TOOLS_PAGE.copiedLabel : TOOLS_PAGE.copyLabel}
      </button>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--slate)", margin: "14px 0 0" }}>{clause.note}</p>
    </div>
  );
}

function Compare({ compare }: { compare: ToolCompare }) {
  return (
    <div>
      <h4 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px", color: "var(--ink)" }}>{compare.title}</h4>
      <div className="grid grid-2">
        {[compare.ours, compare.court].map((col, i) => (
          <div key={col.label} className="card" style={{ padding: "20px 18px", background: i === 0 ? "var(--clay-tint)" : "var(--card)" }}>
            <h5 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 12px", color: i === 0 ? "var(--clay)" : "var(--ink)" }}>{col.label}</h5>
            <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.points.map((pt) => (
                <li key={pt} style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--slate)" }}>{pt}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegalTools() {
  const jsonLd = pageJsonLd([pageNode("WebPage", TOOLS_PAGE.title, TOOLS_PAGE.desc, TOOLS_PAGE.url)]);

  return (
    <>
      <PageMeta title={`${TOOLS_PAGE.title} | LALUM`} description={TOOLS_PAGE.desc} path={`/${TOOLS_PAGE.path}`} jsonLd={jsonLd} />

      <section className="wrap section" style={{ maxWidth: 900, paddingTop: 60 }}>
        <div className="pillar-hero">
          <p className="eyebrow">{TOOLS_PAGE.eyebrow}</p>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
            {TOOLS_PAGE.h1}
          </h1>
          <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch", margin: 0 }}>{TOOLS_PAGE.lede}</p>
        </div>
      </section>

      {LEGAL_TOOLS.map((tool) => (
        <section key={tool.slug} id={tool.slug} className="wrap section section-line" style={{ maxWidth: 900 }}>
          <div style={{ maxWidth: "58ch", margin: "0 0 28px" }}>
            <span className="pillar-card-icon"><Icon name={tool.icon} size={22} /></span>
            <p className="eyebrow" style={{ marginTop: 16 }}>{tool.eyebrow}</p>
            <h2 className="h2">{tool.title}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{tool.lede}</p>
          </div>
          <div className="print-target">
            <Diagnostic
              questions={tool.questions}
              bands={tool.bands}
              startLabel={tool.startLabel}
              output={() => (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {tool.clause ? <Clause clause={tool.clause} /> : null}
                  {tool.compare ? <Compare compare={tool.compare} /> : null}
                  <button type="button" className="btn btn-outline no-print" onClick={() => window.print()} style={{ alignSelf: "flex-start" }}>
                    <Icon name="file" size={16} /> {TOOLS_PAGE.printLabel}
                  </button>
                </div>
              )}
            />
          </div>
        </section>
      ))}

      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--slate)", margin: 0 }}>{TOOLS_PAGE.disclaimer}</p>
      </section>
    </>
  );
}
