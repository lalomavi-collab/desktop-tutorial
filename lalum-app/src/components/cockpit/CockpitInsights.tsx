// Chart strips for the cockpit screens. Presentational: each takes rows the screen already loaded, so no extra requests.
import { AreaChart, BarsH, Donut, Gauge, MiniBars, PillBars } from "./CockpitCharts";
import { series } from "../../lib/cockpit/dashboard";
import type { Inquiry, PersonScore, Reply, Scorecard, Task } from "../../lib/cockpit/work";
import { PRACTICE } from "../../lib/cockpit/shared";

const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const Card = ({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) => (
  <div className="ck-card db-card" style={wide ? { gridColumn: "span 2" } : undefined}><h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800 }}>{title}</h3>{children}</div>
);
const Strip = ({ children }: { children: React.ReactNode }) => <div className="ck-insights">{children}</div>;

export function InquiryInsights({ inquiries, replies, targetMinutes }: { inquiries: Inquiry[]; replies: Reply[]; targetMinutes: number }) {
  if (inquiries.length === 0) return null;
  const weekly = series(inquiries.map((i) => i.received_at), "weekly", 10);
  const first = new Map<string, Reply>();
  for (const r of replies) if (!first.has(r.inquiry_id)) first.set(r.inquiry_id, r);
  const answered = inquiries.filter((i) => first.has(i.id));
  const inTarget = answered.filter((i) => mins(i.received_at, first.get(i.id)!.replied_at) <= targetMinutes).length;
  const by = (s: string) => inquiries.filter((i) => i.status === s).length;
  return (
    <Strip>
      <Card title="פניות לפי שבוע" wide><AreaChart id="in-w" values={weekly.values} labels={weekly.labels} unit="פניות" /></Card>
      <Card title="עמידה ביעד המענה"><Gauge pct={answered.length ? Math.round((100 * inTarget) / answered.length) : 0} label="נענו בתוך היעד" sub={`${answered.length} מתוך ${inquiries.length} נענו`} /></Card>
      <Card title="לפי סטטוס"><PillBars items={[{ label: "חדשות", value: by("NEW"), color: "#f5c431" }, { label: "נראו", value: by("SEEN"), color: "#8ed46a" }, { label: "טופלו", value: by("HANDLED"), color: "#4ea53a" }]} /></Card>
    </Strip>
  );
}

export function TaskInsights({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  const now = Date.now(), day = 86400000;
  const open = tasks.filter((t) => t.status === "OPEN");
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const names = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const next = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(now + k * day);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { label: names[d.getDay()], v: open.filter((t) => t.due_at && new Date(t.due_at).getTime() >= Math.max(start, now) && new Date(t.due_at).getTime() < start + day).length };
  });
  return (
    <Strip>
      <Card title="מצב המשימות"><Donut centre={open.length} sub="פתוחות" segments={[{ label: "פתוחות", value: Math.max(0, open.length - overdue), color: "#8ed46a" }, { label: "באיחור", value: overdue, color: "#cf4b3a" }, { label: "הושלמו", value: done, color: "#3d8d2e" }]} /></Card>
      <Card title="מועדי יעד בשבוע הקרוב" wide><MiniBars values={next.map((n) => n.v)} labels={next.map((n) => n.label)} /></Card>
    </Strip>
  );
}

export function ScoreInsights({ sc, nameOf }: { sc: Scorecard; nameOf: (id: string) => string }) {
  const sum = (f: (p: PersonScore) => number) => sc.people.reduce((a, p) => a + f(p), 0);
  const replies = sum((p) => p.replies), inT = sum((p) => p.replies_in_target), judged = sum((p) => p.tasks_judged), onT = sum((p) => p.tasks_on_time);
  const scored = sc.people.filter((p) => p.score != null);
  return (
    <Strip>
      <Card title="עמידה ביעד המענה"><Gauge pct={replies ? Math.round((100 * inT) / replies) : 0} label="מענים בתוך היעד" sub={`${replies} מענים נרשמו`} /></Card>
      <Card title="משימות בזמן"><Gauge pct={judged ? Math.round((100 * onT) / judged) : 0} label="הושלמו עד המועד" sub={`${judged} משימות נבדקו`} /></Card>
      {scored.length > 0 && <Card title="ציון לפי איש צוות"><BarsH max={100} items={scored.map((p) => ({ label: nameOf(p.user_id), value: p.score ?? 0, color: (p.score ?? 0) >= 80 ? "#3d8d2e" : (p.score ?? 0) >= 60 ? "#e0a312" : "#cf4b3a" }))} /></Card>}
    </Strip>
  );
}

export function MatterInsights({ rows }: { rows: Array<{ practice_area: string; risk_level: string | null; dispatched_at: string }> }) {
  if (rows.length === 0) return null;
  const palette = ["#3d8d2e", "#8ed46a", "#f5c431", "#e0a312", "#7bb36a"];
  const areas = Object.entries(rows.reduce<Record<string, number>>((a, r) => { a[r.practice_area] = (a[r.practice_area] ?? 0) + 1; return a; }, {}));
  const risk = (k: string) => rows.filter((r) => (k === "HIGH_RISK" ? r.risk_level === "HIGH_RISK" : k === "CAUTION" ? r.risk_level === "CAUTION" : r.risk_level !== "HIGH_RISK" && r.risk_level !== "CAUTION")).length;
  const weekly = series(rows.map((r) => r.dispatched_at), "weekly", 10);
  return (
    <Strip>
      <Card title="תיקים לפי תחום"><Donut centre={rows.length} sub="תיקים" segments={areas.map(([k, v], i) => ({ label: PRACTICE[k] ?? k, value: v, color: palette[i % palette.length] }))} /></Card>
      <Card title="רמת סיכון"><BarsH items={[{ label: "תקין", value: risk("OK"), color: "#3d8d2e" }, { label: "זהירות", value: risk("CAUTION"), color: "#e0a312" }, { label: "סיכון גבוה", value: risk("HIGH_RISK"), color: "#cf4b3a" }]} /></Card>
      <Card title="תיקים חדשים לפי שבוע"><MiniBars values={weekly.values} labels={weekly.labels.map((l) => l.split("/")[0])} /></Card>
    </Strip>
  );
}
