import { PageMeta } from "../components/PageMeta";
import { Link } from "../components/AppLink";
import { pageNode, pageJsonLd } from "../lib/schema";
import { SECURITY_PAGE, SECURITY_GROUPS } from "../lib/securityPage";
import { SECURITY_TEMPLATES } from "../lib/securityTemplates";

// The security page: what is built, what was checked, and what is not claimed.
// Every statement comes from lib/securityPage.ts, where it carries the id of its
// verification record. Nothing here is written to sound stronger than the check.

const codeStyle = {
  direction: "ltr" as const,
  textAlign: "left" as const,
  unicodeBidi: "isolate" as const,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 13,
  lineHeight: 1.6,
  overflowX: "auto" as const,
  background: "var(--ivory, #f5f1e8)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "14px 16px",
  margin: "14px 0",
  whiteSpace: "pre" as const,
};

export function SecurityTrust() {
  const P = SECURITY_PAGE;
  const jsonLd = pageJsonLd([pageNode("WebPage", P.title, P.desc, P.url)]);

  return (
    <>
      <PageMeta title={`${P.title} | LALUM`} description={P.desc} path={`/${P.path}`} jsonLd={jsonLd} />

      <section className="wrap section" style={{ maxWidth: 900, paddingTop: 60 }}>
        <p className="eyebrow">{P.eyebrow}</p>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>{P.h1}</h1>
        <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch", margin: 0 }}>{P.lede}</p>
        <p style={{ margin: "22px 0 0" }}>
          <a className="btn" href={P.bookletHref} download style={{ display: "inline-block" }}>{P.bookletLabel}</a>
        </p>
      </section>

      <section className="wrap section section-line" style={{ maxWidth: 900 }}>
        <h2 className="h2" style={{ margin: "0 0 12px" }}>{P.howToReadTitle}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 22, color: "var(--slate)", lineHeight: 1.7, fontSize: 16 }}>
          {P.howToRead.map((t) => <li key={t} style={{ margin: "0 0 6px" }}>{t}</li>)}
        </ul>
      </section>

      {SECURITY_GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="wrap section section-line" style={{ maxWidth: 900, scrollMarginTop: 90 }}>
          <h2 className="h2" style={{ margin: "0 0 18px" }}>{g.title}</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {g.claims.map((c) => (
              <article key={c.id} className="card" style={{ padding: "20px 22px" }}>
                <p className="eyebrow" style={{ margin: 0, textTransform: "none" }}>
                  <span dir="ltr">{c.id}</span>
                  {c.source === "provider" && <> · {P.providerLabel}</>}
                </p>
                <h3 style={{ fontSize: 19, margin: "8px 0 8px" }}>{c.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.7, margin: 0 }}>{c.text}</p>
                {c.limit && (
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--slate)", margin: "12px 0 0", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <b>{P.limitLabel}: </b>{c.limit}
                  </p>
                )}
                {c.url && (
                  <p style={{ margin: "10px 0 0" }}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>{P.providerLink} &rarr;</a>
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section id="templates" className="wrap section section-line" style={{ maxWidth: 900, scrollMarginTop: 90 }}>
        <h2 className="h2" style={{ margin: "0 0 10px" }}>{P.templatesTitle}</h2>
        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "var(--slate)", margin: "0 0 20px" }}>{P.templatesLede}</p>
        <div style={{ display: "grid", gap: 18 }}>
          {SECURITY_TEMPLATES.map((t) => (
            <article key={t.id} className="card" style={{ padding: "22px 24px" }}>
              <p className="eyebrow" style={{ margin: 0, textTransform: "none" }}><span dir="ltr">{t.id}</span> · {t.statusLabel}</p>
              <h3 style={{ fontSize: 20, margin: "8px 0 10px" }}>{t.title}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.7, margin: "0 0 10px" }}>{t.intro}</p>
              {t.download && (
                <p style={{ margin: "0 0 10px" }}>
                  <a href={t.download.href} download style={{ color: "var(--clay)", fontWeight: 600 }}>{t.download.label} &darr;</a>
                </p>
              )}
              {t.code && <pre style={codeStyle} lang={t.code.lang}><code>{t.code.text}</code></pre>}
              <ul style={{ margin: "0 0 10px", paddingInlineStart: 22, lineHeight: 1.7, fontSize: 15.5 }}>
                {t.points.map((x) => <li key={x} style={{ margin: "0 0 6px" }}>{x}</li>)}
              </ul>
              {t.corrections && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--slate)", margin: "14px 0 6px" }}>{P.correctionsLabel}</p>
                  <ul style={{ margin: 0, paddingInlineStart: 22, lineHeight: 1.65, fontSize: 15, color: "var(--slate)" }}>
                    {t.corrections.map((x) => <li key={x} style={{ margin: "0 0 5px" }}>{x}</li>)}
                  </ul>
                </>
              )}
              {t.source && (
                <p style={{ margin: "12px 0 0" }}>
                  <a href={t.source.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>{t.source.label} &rarr;</a>
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="wrap section section-line" style={{ maxWidth: 900 }}>
        <h2 className="h2" style={{ margin: "0 0 12px" }}>{P.notClaimedTitle}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 22, lineHeight: 1.7, fontSize: 16 }}>
          {P.notClaimed.map((t) => <li key={t} style={{ margin: "0 0 8px" }}>{t}</li>)}
        </ul>
      </section>

      <section id="disclosure" className="wrap section section-line" style={{ maxWidth: 900, scrollMarginTop: 90 }}>
        <h2 className="h2" style={{ margin: "0 0 12px" }}>{P.disclosureTitle}</h2>
        {P.disclosure.map((t) => <p key={t} style={{ fontSize: 16, lineHeight: 1.7, margin: "0 0 10px" }}>{t}</p>)}
        <p style={{ fontSize: 16, margin: "0 0 6px" }}>
          <b>{P.contactLabel}: </b><a href={`mailto:${P.contact}`} dir="ltr" style={{ color: "var(--clay)", fontWeight: 600 }}>{P.contact}</a>
          {" · "}<a href={P.securityTxtHref} dir="ltr" style={{ color: "var(--clay)" }}>{P.securityTxtLabel}</a>
        </p>
      </section>

      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <p style={{ fontSize: 15.5, margin: "0 0 18px" }}>
          <Link to={P.legalHref} style={{ color: "var(--clay)", fontWeight: 600 }}>{P.legalLabel} &rarr;</Link>
        </p>
        <p style={{ fontSize: 14, color: "var(--slate)", margin: "0 0 10px" }}>{P.checked}</p>
        <p style={{ fontSize: 13, color: "var(--slate)", margin: 0 }}>{P.disclaimer}</p>
      </section>
    </>
  );
}
