import { useParams } from "react-router-dom";
import { Link } from "../components/AppLink";
import { Icon } from "../components/Icon";
import { PageMeta } from "../components/PageMeta";
import { NotFound } from "./NotFound";
import { courseNode, pageJsonLd } from "../lib/schema";
import { courses, courseFramework, courseSlug, instructorLine, courseDisclaimer } from "../lib/courses";
import { academyPro, proCertificate } from "../lib/academyPro";

// One page per LALUM Academy program. The content is the same data the catalog
// card renders, given a URL of its own so a program can be linked, shared and
// indexed on its own terms instead of living inside an accordion.
export function Course() {
  const { slug = "" } = useParams();
  const all = [...courses, ...academyPro];
  const c = all.find((x) => courseSlug(x) === slug);
  if (!c) return <NotFound />;

  const frame = c.frame ?? courseFramework;
  const isPro = c.track === "pro";
  const path = `/training/${slug}/`;
  const description = `${c.audience} ${frame.sessions}, ${frame.hours}.`;

  return (
    <>
      <PageMeta
        title={`${c.title} | LALUM`}
        description={description}
        path={path}
        jsonLd={pageJsonLd([courseNode(c.title, description, "PT24H", isPro ? "online" : "onsite")])}
      />

      <section dir="rtl" lang="he" className="academy">
        <div className="wrap section" style={{ maxWidth: "80ch" }}>
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>
            <Link to="/training" className="course-title-link">LALUM Academy</Link>
            {" · "}
            {c.category}
          </p>

          <h1 className="h1 serif" style={{ color: "var(--paper)", margin: "0 0 18px" }}>{c.title}</h1>

          <div className="course-frame" style={{ marginBottom: 22 }}>
            <span><Icon name="calendar" size={14} /> {frame.sessions}</span>
            <span><Icon name="spark" size={14} /> {frame.hours}</span>
            <span><Icon name="user" size={14} /> {frame.group}</span>
            <span><Icon name="pin" size={14} /> {frame.place}</span>
          </div>

          <div className="course-meta" style={{ marginBottom: 22 }}>
            <div><span className="course-meta-k">קהל יעד:</span> {c.audience}</div>
            <div><span className="course-meta-k">{c.tailoringLabel ?? "התאמה עסקית:"}</span> {c.tailoring}</div>
            <div><span className="course-meta-k">מבנה:</span> {courseFramework.perSession}</div>
          </div>

          <div className="course-capstone" style={{ borderColor: c.accent, marginBottom: 26 }}>
            <div className="course-capstone-k" style={{ color: c.accent === "#9a7328" ? "#c79a3f" : "var(--clay-soft)" }}>פרויקט גמר</div>
            <div className="course-capstone-name" dir="ltr">{c.capstoneName}</div>
            <p className="course-capstone-desc">{c.capstoneDesc}</p>
          </div>

          <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 14px" }}>{frame.sessions} בתוכנית</h2>
          <ol className="course-sessions" style={{ marginBottom: 26 }}>
            {c.sessions.map((s) => (
              <li key={s.n} className="course-session">
                <span className="course-session-n">{s.n}</span>
                <span className="course-session-t">{s.title}</span>
              </li>
            ))}
          </ol>

          {isPro && <p className="course-fineprint" style={{ marginBottom: 18 }}>{proCertificate}</p>}

          <Link to={`/book?program=${slug}`} className="btn btn-clay course-cta">
            <Icon name="calendar" size={16} /> {c.ctaLabel ?? "תיאום קורס In-House לארגון"}
          </Link>

          <p className="course-fineprint">{instructorLine}</p>
          <p className="course-fineprint">{courseDisclaimer}</p>

          <p style={{ marginTop: 28 }}>
            <Link to="/training" className="course-title-link">חזרה לכל התוכניות</Link>
          </p>
        </div>
      </section>
    </>
  );
}
