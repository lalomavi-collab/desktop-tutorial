// Campaign dashboard: the Legal AI campaign from a Google search to a booked meeting, on one screen. The numbers are synced once a day by
// lalum-campaign-sync (Search Console, Cloudflare Web Analytics, the Facebook page and its Instagram account, Meta Ads, the site's own
// forms); LinkedIn and paid channels without an API are typed in at the bottom. A source that is not connected says so instead of showing zero. Platform admin only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { Icon } from "../../components/Icon";
import { BarsH } from "../../components/cockpit/CockpitCharts";
import { MarketChart } from "../../components/cockpit/MarketChart";
import { money } from "../../lib/cockpit/shared";
import { loadCampaignSummary, refreshCampaigns, saveManualPaid, saveManualPost } from "../../lib/cockpit/campaigns";
import type { SummaryState } from "../../lib/cockpit/campaigns";
import {
  channels, connected, funnel, health, isAiQuery, kpis, landingTable, PAID_CHANNEL_HE, paidTotals, postShares, postViews, series, shortDay, social, windowOf,
} from "../../lib/cockpit/campaignsCore.ts";
import type { CampaignSummary, Kpi } from "../../lib/cockpit/campaignsCore.ts";

const CODE = "legal-ai";
const nf = (v: number) => v.toLocaleString("he-IL");
const ICON: Record<string, string> = { gsc_impr: "search", gsc_clicks: "compass", gsc_pos: "spark", cf_visits: "home", landing: "file", requests: "phone", fb: "share", spend: "card" };
const PLATFORM_HE: Record<string, string> = { facebook: "פייסבוק", linkedin: "לינקדאין", instagram: "אינסטגרם", telegram: "טלגרם", newsletter: "ניוזלטר" };
const short = (t: string) => (!t ? "פוסט" : t.length > 60 ? t.slice(0, 58).trimEnd() + "…" : t);
const cell = (v: number | null | undefined) => (v == null ? "" : nf(v));
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

function Delta({ d }: { d: number | null }) {
  if (d == null) return null;
  const cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
  return <span className={`db-delta ${cls}`}><span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "■"}</span> <bdi dir="ltr">{d > 0 ? "+" : ""}{d}%</bdi><span className="db-sr"> לעומת התקופה הקודמת</span></span>;
}

function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className="ck-card db-kcard">
      <div className="db-khead"><span className="db-kicon"><Icon name={ICON[k.key] ?? "spark"} size={18} /></span><span className="db-klabel">{k.label}</span></div>
      <div>
        <div className="db-kval">{k.cur == null ? <small>{k.empty ?? "לא מחובר"}</small> : <b><bdi dir="ltr">{k.money ? money(k.cur) : nf(k.cur)}</bdi></b>}</div>
        <Delta d={k.delta} />
        <div className="ck-meta">{k.note}</div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="ck-meta" style={{ padding: "12px 0" }}>{text}</div>;
}

function Charts({ s }: { s: CampaignSummary }) {
  const g = windowOf(s, "gsc"), c = windowOf(s, "cloudflare");
  const gs = series(s.site, "gsc", ["impressions", "clicks"], g);
  const cs = series(s.site, "cloudflare", ["visits", "pageviews"], c);
  const req = series(s.site, "internal", ["bookings", "consultations", "leads", "site_leads"], c);
  const reqPerDay = req.labels.map((_, i) => req.values.reduce((a, v) => a + (v[i] ?? 0), 0));
  return (
    <div className="db-grid one">
      <div className="ck-card db-card">
        <div className="db-head"><h3>נוכחות בגוגל</h3><span className="ck-meta">עד {shortDay(g.to)}, גוגל מפרסם באיחור של יומיים עד שלושה</span></div>
        {connected(s, "gsc")
          ? <MarketChart title="חשיפות וכניסות מגוגל" labels={gs.labels} series={[{ key: "impr", label: "חשיפות", color: "var(--chart-cat-2, #3b6ea5)", values: gs.values[0], kind: "area" }]} bars={{ label: "כניסות", values: gs.values[1], color: "var(--chart-ok, #216f33)" }} ma={7} avg />
          : <Empty text="Search Console עוד לא מחובר. אחרי שהמפתח יוזן, הסנכרון הראשון ימלא 90 ימים אחורה." />}
      </div>
      <div className="ck-card db-card">
        <div className="db-head"><h3>ביקורים באתר ופניות</h3><span className="ck-meta">עד {shortDay(c.to)}</span></div>
        {connected(s, "cloudflare")
          ? <MarketChart title="ביקורים, צפיות ופניות" labels={cs.labels} series={[{ key: "pv", label: "צפיות", color: "var(--chart-neutral, #6b7a6e)", values: cs.values[1], kind: "dashed" }, { key: "vi", label: "ביקורים", color: "var(--chart-ok, #216f33)", values: cs.values[0], kind: "area" }]} bars={{ label: "פניות", values: reqPerDay, color: "var(--chart-warn, #b7791f)" }} ma={7} />
          : <Empty text="Cloudflare Web Analytics עוד לא מחובר. בלי זה אין ביקורים, דפים ומקורות הפניה." />}
      </div>
    </div>
  );
}

function Funnel({ s }: { s: CampaignSummary }) {
  const st = funnel(s);
  const shown = st.filter((x) => x.value != null);
  const missing = st.filter((x) => x.value == null).map((x) => x.label);
  const top = Math.max(1, ...shown.map((x) => x.value as number));
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>המשפך: מחיפוש לפגישה</h3><span className="ck-meta">{s.days} ימים אחרונים</span></div>
      {shown.length ? (
        <ul className="db-ranks">
          {shown.map((x) => (
            <li key={x.key} className="db-rank">
              <div><span>{x.label}</span><span><b>{nf(x.value as number)}</b>{x.rate != null && <small> ({x.rate}% מהשלב הקודם)</small>}</span></div>
              <span className="db-rbar" aria-hidden="true"><i style={{ width: `${Math.max(2, ((x.value as number) / top) * 100)}%`, background: "var(--chart-ok, #216f33)" }} /></span>
            </li>
          ))}
        </ul>
      ) : <Empty text="אין עדיין נתונים לאף שלב." />}
      {missing.length > 0 && <div className="db-note">ממתינים לחיבור: {missing.join(", ")}.</div>}
      <div className="db-note">הפניות נספרות מכל הטפסים באתר, לא רק מהקמפיין. ייחוס מדויק לקמפיין יגיע עם תיוג UTM בקישורים.</div>
    </div>
  );
}

function Posts({ s }: { s: CampaignSummary }) {
  const rows = s.posts;
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>פוסטים</h3><span className="ck-meta">ספירה מצטברת, נכון ליום הסנכרון</span></div>
      {rows.length === 0 ? <Empty text="אין פוסטים רשומים." /> : (
        <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>#</th><th>פוסט</th><th>ערוץ</th><th>פורסם</th><th>צפיות</th><th>לייקים</th><th>תגובות</th><th>שיתופים</th><th /></tr></thead><tbody>
          {rows.map((p, i) => (
            <tr key={`${p.platform}-${p.postNo ?? ""}-${p.permalink ?? i}`}>
              <td>{p.postNo != null ? String(p.postNo).padStart(3, "0") : ""}</td>
              <td>{p.permalink ? <a href={p.permalink} target="_blank" rel="noopener noreferrer">{short(p.title)}</a> : short(p.title)}</td>
              <td>{PLATFORM_HE[p.platform] ?? p.platform}</td>
              <td>{p.publishedAt ? shortDay(p.publishedAt.slice(0, 10)) : ""}</td>
              <td>{cell(postViews(p.metrics))}</td>
              <td>{cell(p.metrics.reactions)}</td>
              <td>{cell(p.metrics.comments)}</td>
              <td>{cell(postShares(p.metrics))}</td>
              <td style={{ whiteSpace: "nowrap" }}>{!p.linked ? <span className="ck-badge yellow" style={{ whiteSpace: "nowrap" }}>לא נמצא בדף</span> : !p.inCampaign ? <span className="ck-badge" style={{ whiteSpace: "nowrap" }}>מחוץ לקמפיין</span> : null}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      <div className="db-note">פוסט שסומן "לא נמצא בדף" עוד לא קושר לפוסט שפורסם בפייסבוק. הקישור נעשה לפי מילות הפתיחה. פוסט באינסטגרם שנפתח באותן מילים כמו פוסט קמפיין בפייסבוק מקבל את המספר שלו.</div>
    </div>
  );
}

function Social({ s }: { s: CampaignSummary }) {
  const rows = social(s);
  const tone = { ok: "green", warn: "yellow", off: "" } as const;
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>רשתות חברתיות</h3><span className="ck-meta">פוסטים של הקמפיין בלבד, ספירה מצטברת. תא ריק: אין נתון</span></div>
      <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>רשת</th><th>מצב</th><th>עוקבים</th><th>פוסטים</th><th>צפיות</th><th>מעורבות</th><th>נכון ל</th></tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.platform}>
            <td>{r.label}</td>
            <td><span className={`ck-badge ${tone[r.tone]}`} style={{ whiteSpace: "nowrap" }}>{r.status}</span></td>
            <td>{cell(r.followers)}</td><td>{nf(r.posts)}</td><td>{cell(r.views)}</td><td>{cell(r.engagement)}</td>
            <td>{r.asOf ? shortDay(r.asOf) : ""}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="db-note">פייסבוק ואינסטגרם נמשכים אוטומטית עם טוקן קריאה אחד של הדף. לינקדאין מוזן ידנית למטה, כי ה-API שלה דורש אישור מראש מלינקדאין. מעורבות: לייקים, תגובות ושיתופים.</div>
    </div>
  );
}

function LandingPages({ s }: { s: CampaignSummary }) {
  const rows = landingTable(s);
  const cfOn = connected(s, "cloudflare"), gscOn = connected(s, "gsc");
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>דפי הקמפיין</h3><span className="ck-meta">{s.days} ימים, כל דף בנפרד</span></div>
      {rows.length === 0 ? <Empty text="לקמפיין לא הוגדרו דפים." /> : (
        <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>דף</th><th>צפיות</th><th>שינוי</th><th>ביקורים</th><th>חשיפות בגוגל</th><th>כניסות מגוגל</th></tr></thead><tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td><bdi dir="ltr">{r.key}</bdi></td>
              <td>{cfOn ? nf(r.pageviews) : ""}</td><td>{cfOn && <Delta d={r.delta} />}</td><td>{cfOn ? nf(r.visits) : ""}</td>
              <td>{gscOn ? nf(r.impressions) : ""}</td><td>{gscOn ? nf(r.clicks) : ""}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      <div className="db-note">דף שמופיע עם אפס לא קיבל אף ביקור בתקופה. גרסאות השפה של אותו דף נספרות יחד. תא ריק: המקור עוד לא מחובר.</div>
    </div>
  );
}

function Search({ s }: { s: CampaignSummary }) {
  return (
    <div className="db-grid b">
      <div className="ck-card db-card">
        <div className="db-head"><h3>חיפושים מובילים</h3><span className="ck-meta">לפי חשיפות</span></div>
        {s.queries.length === 0 ? <Empty text="אין נתוני חיפוש עדיין." /> : (
          <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>חיפוש</th><th>חשיפות</th><th>כניסות</th><th>מיקום</th></tr></thead><tbody>
            {s.queries.map((q) => (
              <tr key={q.key}><td><bdi>{q.key}</bdi> {isAiQuery(q.key) && <span className="ck-badge green">AI</span>}</td><td>{nf(q.impressions)}</td><td>{nf(q.clicks)}</td><td>{q.position ?? ""}</td></tr>
            ))}
          </tbody></table></div>
        )}
      </div>
      <div className="ck-card db-card">
        <div className="db-head"><h3>דפים</h3><span className="ck-meta">מסומן: דף של הקמפיין</span></div>
        {s.pathsCf.length > 0 ? (
          <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>דף</th><th>צפיות</th><th>ביקורים</th></tr></thead><tbody>
            {s.pathsCf.map((p) => <tr key={p.key}><td><bdi dir="ltr">{p.key}</bdi> {p.campaign && <span className="ck-badge green">קמפיין</span>}</td><td>{nf(p.pageviews)}</td><td>{nf(p.visits)}</td></tr>)}
          </tbody></table></div>
        ) : s.pagesGsc.length > 0 ? (
          <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>דף (מגוגל)</th><th>כניסות</th><th>חשיפות</th></tr></thead><tbody>
            {s.pagesGsc.map((p) => <tr key={p.key}><td><bdi dir="ltr">{p.key}</bdi> {p.campaign && <span className="ck-badge green">קמפיין</span>}</td><td>{nf(p.clicks)}</td><td>{nf(p.impressions)}</td></tr>)}
          </tbody></table></div>
        ) : <Empty text="אין נתוני דפים עדיין." />}
      </div>
    </div>
  );
}

function Sources({ s }: { s: CampaignSummary }) {
  const ch = channels(s.referrers).filter((x) => x.channel !== "internal");
  return (
    <div className="db-grid">
      <div className="ck-card db-card">
        <div className="db-head"><h3>מאיפה הגיעו המבקרים</h3><span className="ck-meta">ביקורים, {s.days} ימים</span></div>
        {ch.length === 0 ? <Empty text="אין נתוני מקורות עדיין (Cloudflare)." /> : <BarsH items={ch.map((x) => ({ label: x.label, value: x.cur }))} />}
        {s.referrers.length > 0 && (
          <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>מקור</th><th>עכשיו</th><th>קודם</th></tr></thead><tbody>
            {s.referrers.slice(0, 10).map((r) => <tr key={r.key}><td><bdi dir="ltr">{r.key}</bdi></td><td>{nf(r.cur)}</td><td>{nf(r.prev)}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
      <div className="ck-card db-card">
        <div className="db-head"><h3>מאיזה דף נשלחו פניות</h3></div>
        {s.leadPaths.length === 0 ? <Empty text="אין פניות עם דף מקור בתקופה." /> : (
          <BarsH items={s.leadPaths.map((r) => ({ label: r.key, value: r.leads }))} />
        )}
        <div className="db-note">רק טופס הלידים שומר את הדף שממנו נשלח. טופס קביעת הפגישה והניוזלטר עוד לא.</div>
      </div>
    </div>
  );
}

function Paid({ s }: { s: CampaignSummary }) {
  const p = paidTotals(s);
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>ממומן</h3><span className="ck-meta">{s.days} ימים</span></div>
      {!p.any ? <Empty text="לא רץ קמפיין ממומן. החיבור ל-Meta Ads מוכן וממתין לטוקן לקריאה בלבד; ערוצים אחרים מוזנים ידנית למטה." /> : (
        <>
          <div className="ck-meta">סה"כ: <b>{money(p.spend)}</b>, {nf(p.clicks)} קליקים, {nf(p.leads)} לידים{p.leads > 0 ? `, ${money(Math.round(p.spend / p.leads))} לליד` : ""}.</div>
          <div className="ck-table-wrap"><table className="db-tbl"><thead><tr><th>קמפיין או ערוץ</th><th>הוצאה</th><th>קליקים</th><th>לידים</th></tr></thead><tbody>
            {p.rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{money(r.spend)}</td><td>{nf(r.clicks)}</td><td>{nf(r.leads)}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}

function Health({ s, onRefresh, busy, msg }: { s: CampaignSummary; onRefresh: () => void; busy: boolean; msg: { ok: boolean; text: string } | null }) {
  const [now] = useState(() => Date.now());
  const h = health(s, now);
  const tone = { ok: "green", warn: "yellow", bad: "red", off: "" } as const;
  return (
    <div className="ck-card db-card">
      <div className="db-head"><h3>מצב החיבורים</h3><button type="button" className="ck-btn" disabled={busy} onClick={onRefresh}>{busy ? "מסנכרן..." : "רענון עכשיו"}</button></div>
      <ul className="ck-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {h.map((x) => <li key={x.source} className="ck-row" style={{ justifyContent: "space-between" }}><span>{x.label}</span><span className={`ck-badge ${tone[x.tone]}`}>{x.text}</span></li>)}
      </ul>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="db-note">הסנכרון רץ פעמיים ביום, בסביבות 08:30 ו 13:30. נתוני גוגל מתעדכנים בריצת הצהריים, אחרי שקובץ Search Console היומי נשמר. אפשר לרענן ידנית פעם בעשר דקות.</div>
    </div>
  );
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

function ManualEntry({ onSaved }: { onSaved: () => void }) {
  const [post, setPost] = useState({ permalink: "", title: "", publishedOn: "", day: todayIso(), impressions: "", reactions: "", comments: "", shares: "", clicks: "" });
  const [paid, setPaid] = useState({ channel: "google_ads", periodEnd: todayIso(), spend: "", impressions: "", clicks: "", leads: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const metrics = (o: Record<string, string>, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k].trim() !== "").map((k) => [k, num(o[k])]));
  const bad = (m: Record<string, number | null>) => Object.values(m).some((v) => v == null || !Number.isFinite(v) || v < 0);
  const savePost = async () => {
    const m = metrics(post, ["impressions", "reactions", "comments", "shares", "clicks"]);
    if (bad(m)) return setMsg({ ok: false, text: "כל ערך צריך להיות מספר חיובי." });
    const err = await saveManualPost({ platform: "linkedin", permalink: post.permalink.trim(), title: post.title, publishedOn: post.publishedOn, day: post.day, metrics: m });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "נתוני הפוסט נשמרו." });
    if (!err) { setPost({ ...post, impressions: "", reactions: "", comments: "", shares: "", clicks: "" }); onSaved(); }
  };
  const savePaid = async () => {
    const m = metrics(paid, ["spend", "impressions", "clicks", "leads"]);
    if (bad(m)) return setMsg({ ok: false, text: "כל ערך צריך להיות מספר חיובי." });
    const err = await saveManualPaid({ channel: paid.channel, periodEnd: paid.periodEnd, metrics: m });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "נתוני הממומן נשמרו." });
    if (!err) { setPaid({ ...paid, spend: "", impressions: "", clicks: "", leads: "" }); onSaved(); }
  };
  const field = (label: string, value: string, set: (v: string) => void, type = "number") => (
    <label className="ck-field"><span className="ck-label">{label}</span><input className="ck-input" type={type} inputMode={type === "number" ? "decimal" : undefined} min={type === "number" ? 0 : undefined} value={value} onChange={(e) => set(e.target.value)} /></label>
  );
  return (
    <div className="db-grid">
      <div className="ck-card db-card">
        <div className="db-head"><h3>פוסט בלינקדאין</h3><span className="ck-meta">הזנה ידנית, פעם בשבוע</span></div>
        <div className="ck-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {field("קישור לפוסט", post.permalink, (v) => setPost({ ...post, permalink: v }), "url")}
          {field("כותרת קצרה", post.title, (v) => setPost({ ...post, title: v }), "text")}
          {field("תאריך פרסום", post.publishedOn, (v) => setPost({ ...post, publishedOn: v }), "date")}
          {field("נכון ליום", post.day, (v) => setPost({ ...post, day: v }), "date")}
          {field("חשיפות", post.impressions, (v) => setPost({ ...post, impressions: v }))}
          {field("תגובות רגש", post.reactions, (v) => setPost({ ...post, reactions: v }))}
          {field("תגובות", post.comments, (v) => setPost({ ...post, comments: v }))}
          {field("שיתופים", post.shares, (v) => setPost({ ...post, shares: v }))}
          {field("קליקים", post.clicks, (v) => setPost({ ...post, clicks: v }))}
        </div>
        <div className="ck-row"><button type="button" className="ck-btn primary" disabled={!post.permalink.trim() || !post.day} onClick={() => void savePost()}>שמירה</button></div>
        <div className="db-note">המספרים מופיעים בלינקדאין תחת "הצגת ניתוח נתונים" בפוסט. ערך ריק לא משנה את מה שנשמר.</div>
      </div>
      <div className="ck-card db-card">
        <div className="db-head"><h3>ממומן בערוץ אחר</h3><span className="ck-meta">סיכום לתקופה, לפי יום הסיום</span></div>
        <div className="ck-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <label className="ck-field"><span className="ck-label">ערוץ</span>
            <select className="ck-select" value={paid.channel} onChange={(e) => setPaid({ ...paid, channel: e.target.value })}>
              {Object.entries(PAID_CHANNEL_HE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {field("סוף התקופה", paid.periodEnd, (v) => setPaid({ ...paid, periodEnd: v }), "date")}
          {field("הוצאה בש\"ח", paid.spend, (v) => setPaid({ ...paid, spend: v }))}
          {field("חשיפות", paid.impressions, (v) => setPaid({ ...paid, impressions: v }))}
          {field("קליקים", paid.clicks, (v) => setPaid({ ...paid, clicks: v }))}
          {field("לידים", paid.leads, (v) => setPaid({ ...paid, leads: v }))}
        </div>
        <div className="ck-row"><button type="button" className="ck-btn primary" disabled={!paid.periodEnd} onClick={() => void savePaid()}>שמירה</button></div>
        <div className="db-note">קמפיין ממומן במטא נמשך אוטומטית ואין צורך להזין אותו כאן.</div>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
    </div>
  );
}

export function CampaignsView({ preload }: { preload?: CampaignSummary }) {
  const [days, setDays] = useState(28);
  const [res, setRes] = useState<SummaryState>(preload ? { state: "ready", data: preload } : { state: "loading" });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (preload) return;
    let on = true;
    void loadCampaignSummary(CODE, days).then((r) => { if (on) setRes(r); });
    return () => { on = false; };
  }, [days, tick, preload]);
  const refresh = useCallback(async () => {
    setBusy(true);
    const r = await refreshCampaigns();
    setBusy(false);
    setMsg(r);
    if (r.ok) setTick((t) => t + 1);
  }, []);
  const k = useMemo(() => (res.state === "ready" ? kpis(res.data) : []), [res]);

  if (res.state !== "ready") {
    if (res.state === "loading") return <div className="ck-meta">טוען...</div>;
    if (res.state === "unavailable") return <div className="ck-card ck-empty">טבלאות הקמפיינים עוד לא הוחלו במסד הנתונים. המסך יתמלא אחרי הדבקת המיגרציה והסנכרון הראשון.</div>;
    return <div className="ck-card ck-empty">המסך זמין למנהל המערכת עם אימות דו-שלבי בלבד.</div>;
  }
  const s = res.data;
  return (
    <div className="ck-stack">
      <div className="ck-card db-card">
        <div className="db-head">
          <h3>{s.campaign ? `קמפיין ${s.campaign.name}` : "קמפיינים"}</h3>
          <div className="ck-row" role="group" aria-label="תקופה">
            {[28, 90].map((d) => <button key={d} type="button" className={`ck-btn${days === d ? " primary" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} ימים</button>)}
          </div>
        </div>
        <div className="ck-meta">
          {s.campaign ? <>מאז {shortDay(s.campaign.startsOn)}.{s.campaign.startsOn.slice(0, 4)}. דפי הקמפיין: <bdi dir="ltr">{s.campaign.landingPrefixes.join(", ")}</bdi>. </> : null}
          כל מספר מושווה לתקופה שלפניו באותו אורך.
        </div>
      </div>
      <div className="db-kgrid">{k.map((x) => <KpiCard key={x.key} k={x} />)}</div>
      <Charts s={s} />
      <div className="db-grid b"><Funnel s={s} /><LandingPages s={s} /></div>
      <div className="db-grid"><Social s={s} /><Health s={s} onRefresh={() => void refresh()} busy={busy} msg={msg} /></div>
      <Posts s={s} />
      <Search s={s} />
      <Sources s={s} />
      <Paid s={s} />
      {!preload && <ManualEntry onSaved={() => setTick((t) => t + 1)} />}
    </div>
  );
}

export function CampaignsPage() {
  return (
    <CockpitFrame title="קמפיינים" description="קמפיין Legal AI במקום אחד: גוגל, ביקורים באתר, דפי הקמפיין, המשפך עד לפגישה, פייסבוק, אינסטגרם ולינקדאין, ממומן ומצב החיבורים. מתעדכן פעמיים ביום." path="/workspace/campaigns">
      {({ platformAdmin }) => platformAdmin ? <CampaignsView /> : <div className="ck-card ck-empty">המסך זמין למנהל המערכת בלבד.</div>}
    </CockpitFrame>
  );
}
