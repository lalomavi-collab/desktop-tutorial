import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";
import { courses } from "../lib/courses";

// A bold, on-brand home band that surfaces LALUM Academy: dark premium to match
// the catalog, with the four course banners as a live preview and a clear CTA
// into the programs. Prominent, but in synergy with the rest of the app rather
// than an interrupting popup.
export function HomeAcademy() {
  const { t } = useLang();
  const a = t.home.academy;
  return (
    <section className="home-academy">
      <div className="wrap section home-academy-inner">
        <div className="home-academy-copy">
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>{a.eyebrow}</p>
          <h2 className="serif home-academy-title">{a.title}</h2>
          <p className="home-academy-body">{a.body}</p>
          <div className="home-academy-meta"><Icon name="check" size={15} /> {a.meta}</div>
          <Link to="/training#programs" className="btn btn-clay home-academy-cta">
            <Icon name="book" size={17} /> {a.cta}
          </Link>
        </div>

        <Link to="/training#programs" className="home-academy-grid" aria-label={a.cta}>
          {courses.map((c, i) => (
            <span key={c.id} className="ha-thumb">
              <img src={c.image} alt="" loading="lazy" />
              <span className="ha-thumb-label">{a.cats[i]}</span>
            </span>
          ))}
        </Link>
      </div>
    </section>
  );
}
