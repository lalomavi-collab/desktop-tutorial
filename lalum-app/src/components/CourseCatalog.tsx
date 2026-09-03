import { useState } from "react";
import { scriptDir } from "../lib/hreflang";
import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { courses, courseFramework, courseSlug, instructorLine, courseDisclaimer, type Course } from "../lib/courses";
import { academyPro, proCertificate, proCohort } from "../lib/academyPro";

// LALUM Academy catalog: a dark premium, RTL band showing the flagship
// executive programs. Content is Hebrew, so the whole section is forced RTL
// regardless of the app language. Each card carries a per-course banner image
// (with a branded gradient fallback until an image is supplied), the shared
// framework, the capstone highlight, and a collapsible six-session syllabus.
// Two lines live here: the In-House organisational programs, unchanged, and
// LALUM Academy Pro for individual professionals.
export function CourseCatalog() {
  const [openId, setOpenId] = useState<string | undefined>();
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const cardProps = (c: Course) => ({
    c,
    open: openId === c.id,
    onToggle: () => setOpenId(openId === c.id ? undefined : c.id),
    failed: failed.has(c.id),
    onImgError: () => setFailed((s) => new Set(s).add(c.id)),
  });

  return (
    <section id="programs" dir="rtl" lang="he" className="academy">
      <div className="wrap section">
        <div style={{ textAlign: "center", maxWidth: "62ch", margin: "0 auto 46px" }}>
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>LALUM Academy</p>
          <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 14px" }}>תוכניות הדרכה מתקדמות לארגון</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>
            תוכניות דגל למגוון רחב של תעשיות, בהעברה פנים-ארגונית בבית העסק, המשלבות סטאק כלי AI, גבולות מותר ואסור, ופרויקט גמר מעשי המותאם לפעילות שלכם.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#A9A296", margin: "12px 0 0" }}>{instructorLine}</p>
        </div>

        <div className="academy-grid">
          {courses.map((c) => (
            <CourseCard key={c.id} {...cardProps(c)} />
          ))}
        </div>

        <div id="academy-pro" style={{ textAlign: "center", maxWidth: "62ch", margin: "72px auto 46px" }}>
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>LALUM Academy Pro</p>
          <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 14px" }}>תוכניות לבעלי מקצוע</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>
            אותו מבנה, בקבוצה פתוחה ובלמידה מקוונת, לעורכי דין, לשמאי מקרקעין ולרואי חשבון ויועצי מס. שישה מפגשים, פרויקט גמר שנשאר אצלכם.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#A9A296", margin: "12px 0 0" }}>{proCertificate}</p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#A9A296", margin: "6px 0 0" }}>{proCohort}</p>
        </div>

        <div className="academy-grid">
          {academyPro.map((c) => (
            <CourseCard key={c.id} {...cardProps(c)} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CourseCard({ c, open, onToggle, failed, onImgError }: { c: Course; open: boolean; onToggle: () => void; failed: boolean; onImgError: () => void }) {
  const showImg = c.image && !failed;
  const frame = c.frame ?? courseFramework;
  const slug = courseSlug(c);
  return (
    <article className="course-card">
      <div className="course-banner" style={{ background: `linear-gradient(135deg, ${c.accent} 0%, #1b1b1b 120%)` }}>
        {showImg && <img src={c.image} alt="" loading="lazy" onError={onImgError} className="course-banner-img" />}
        <span className="course-banner-icon" aria-hidden="true"><Icon name={c.icon} size={30} /></span>
        <span className="course-badge">{c.category}</span>
      </div>

      <div className="course-body">
        <h3 className="course-title serif">
          <Link to={`/training/${slug}`} className="course-title-link" {...scriptDir(c.title)}>{c.title}</Link>
        </h3>

        <div className="course-frame">
          <span><Icon name="calendar" size={14} /> {frame.sessions}</span>
          <span><Icon name="spark" size={14} /> {frame.hours}</span>
          <span><Icon name="user" size={14} /> {frame.group}</span>
          <span><Icon name="pin" size={14} /> {frame.place}</span>
        </div>

        <div className="course-meta">
          <div><span className="course-meta-k">קהל יעד:</span> {c.audience}</div>
          <div><span className="course-meta-k">{c.tailoringLabel ?? "התאמה עסקית:"}</span> {c.tailoring}</div>
        </div>

        <div className="course-capstone" style={{ borderColor: c.accent }}>
          <div className="course-capstone-k" style={{ color: c.accent === "#9a7328" ? "#c79a3f" : "var(--clay-soft)" }}>פרויקט גמר</div>
          <div className="course-capstone-name" dir="ltr">{c.capstoneName}</div>
          <p className="course-capstone-desc">{c.capstoneDesc}</p>
        </div>

        <button type="button" className="course-syllabus-toggle" aria-expanded={open} onClick={onToggle}>
          <span>{frame.sessions} בתוכנית</span>
          <span className={"faq-chevron" + (open ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={16} /></span>
        </button>
        {open && (
          <ol className="course-sessions">
            {c.sessions.map((s) => (
              <li key={s.n} className="course-session">
                <span className="course-session-n">{s.n}</span>
                <span className="course-session-t">{s.title}</span>
              </li>
            ))}
          </ol>
        )}

        <Link to={`/book?program=${slug}`} className="btn btn-clay course-cta">
          <Icon name="calendar" size={16} /> {c.ctaLabel ?? "תיאום קורס In-House לארגון"}
        </Link>

        <p className="course-fineprint">{instructorLine}</p>
        <p className="course-fineprint">{courseDisclaimer}</p>
      </div>
    </article>
  );
}
