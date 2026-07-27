import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";

// A real 404 page. Previously every unknown URL silently rendered Home with a
// 200, which disoriented users and created soft-404 duplicate content for
// crawlers. Known aliases still have their own routes in App.tsx.
export function NotFound() {
  const { t } = useLang();
  const n = t.ui.notFound;
  return (
    <section className="wrap" style={{ minHeight: "62vh", display: "grid", placeItems: "center", textAlign: "center", padding: "80px 32px" }}>
      <PageMeta title="LALUM" path="/404" noindex />
      <div>
        <div className="eyebrow" style={{ letterSpacing: ".2em" }}>{n.code}</div>
        <h1 className="h1" style={{ margin: "12px 0 0" }}>{n.title}</h1>
        <p className="lede" style={{ maxWidth: "48ch", margin: "18px auto 30px" }}>{n.body}</p>
        <Link to="/" className="btn btn-clay">{n.home}</Link>
      </div>
    </section>
  );
}
