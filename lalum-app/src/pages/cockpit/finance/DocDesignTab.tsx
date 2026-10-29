import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { FinCustomer, FinDocument } from "../../../lib/cockpit/finance";
import { DOC_TYPE, PAY_METHOD } from "../../../lib/cockpit/finance";
import { addressOn, loadBusiness } from "../../../lib/cockpit/businessProfile";
import type { BusinessAddress, BusinessProfile } from "../../../lib/cockpit/businessProfile";
import {
  CURATED, DEFAULT_ANSWERS, DEFAULT_SPEC, FONTS, LAYOUTS, QUESTIONS, buildPalette, checkDesign, i4uLogoSize, invoice4uHints, logoColours, parseSpec, suggestDesigns,
} from "../../../lib/cockpit/docDesign";
import type { Answers, DesignSpec, FontKey, Suggestion } from "../../../lib/cockpit/docDesign";
import { renderDocument, sampleDoc, TITLE } from "../../../lib/cockpit/docDesignRender";
import type { RenderBrand, RenderCustomer, RenderDoc, RenderDocType, RenderIssuer } from "../../../lib/cockpit/docDesignRender";

// Document design (owner's request, 29.10.2026): a short questionnaire, designs suggested from the answers and the logo's own colours
// (as many pages of them as wanted), fine tuning, and saved designs with a default per document type.
// The legal document is still the one the issuing provider produces and signs. This screen says so, and gives what to set there.

interface BrandRow { logo_data_url: string | null; phone: string | null; email: string | null; website: string | null; bank: { bank: string; branch: string; account: string } | null; footer_note: string | null }
interface DesignRow { id: string; name: string; spec: unknown; default_for: string[]; updated_at: string }
const EMPTY_BRAND: BrandRow = { logo_data_url: null, phone: null, email: null, website: null, bank: null, footer_note: null };
const DEFAULT_LOGO = "/lalum-logo.svg";
const MAX_LOGO_BYTES = 300 * 1024;
const TYPES = Object.keys(TITLE) as RenderDocType[];
const PAGE_W = 794, PAGE_H = 1123;

/** Loads an image and returns it with a usable size. An SVG with only a viewBox has no natural size in every browser, so it is read from the viewBox. */
async function loadImage(src: string): Promise<{ img: HTMLImageElement; w: number; h: number }> {
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("logo")); img.src = src; });
  let w = img.naturalWidth, h = img.naturalHeight;
  if (/svg/.test(src) && (!w || !h || (w === 300 && h === 150))) {
    const text = src.startsWith("data:") ? atob(src.split(",")[1] ?? "") : await (await fetch(src)).text();
    const vb = /viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
    if (vb) { w = Number(vb[1]) * 4; h = Number(vb[2]) * 4; }
  }
  return { img, w: w || 600, h: h || 600 };
}
async function analyseLogo(src: string) {
  const { img, w, h } = await loadImage(src);
  const k = Math.min(1, 160 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) return { colours: [], neutral: true };
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return logoColours(ctx.getImageData(0, 0, c.width, c.height).data);
}
/** The logo as Invoice4U accepts it: JPG on white, the long side 250 pixels. */
async function invoice4uLogo(src: string): Promise<string> {
  const { img, w, h } = await loadImage(src);
  const s = i4uLogoSize(w, h);
  const c = document.createElement("canvas");
  c.width = s.w; c.height = s.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, s.w, s.h);
  ctx.drawImage(img, 0, 0, s.w, s.h);
  return c.toDataURL("image/jpeg", 0.92);
}

function Page({ html, scale, title }: { html: string; scale: number; title: string }) {
  return (
    <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, overflow: "hidden", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,.18)", background: "#fff" }}>
      <iframe title={title} srcDoc={html} sandbox="allow-same-origin allow-modals" loading="lazy" tabIndex={-1}
        style={{ width: PAGE_W, height: PAGE_H, border: 0, transform: `scale(${scale})`, transformOrigin: "top right", pointerEvents: "none" }} />
    </div>
  );
}

export function DocDesignTab({ firmId, firmName, level, docs, customers }: { firmId: string; firmName: string; level: number; docs: FinDocument[]; customers: FinCustomer[] }) {
  const canEdit = level >= 4;
  const [brand, setBrand] = useState<BrandRow>(EMPTY_BRAND);
  const [brandDirty, setBrandDirty] = useState(false);
  const [designs, setDesigns] = useState<DesignRow[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [addresses, setAddresses] = useState<BusinessAddress[]>([]);
  const [colours, setColours] = useState<{ colours: string[]; neutral: boolean }>({ colours: [], neutral: true });
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [page, setPage] = useState(0);
  const [spec, setSpec] = useState<DesignSpec>(DEFAULT_SPEC);
  const [editing, setEditing] = useState<{ id: string | null; name: string; defaults: string[] }>({ id: null, name: "", defaults: [] });
  const [docType, setDocType] = useState<RenderDocType>("INVOICE");
  const [source, setSource] = useState<string>("sample");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const preview = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [b, d] = await Promise.all([
      supabase.from("lalum_fin_doc_brand").select("logo_data_url, phone, email, website, bank, footer_note").eq("firm_id", firmId).maybeSingle(),
      supabase.from("lalum_fin_doc_designs").select("id, name, spec, default_for, updated_at").eq("firm_id", firmId).is("archived_at", null).order("updated_at", { ascending: false }),
    ]);
    // Until the migration is applied both read as errors; the screen still works on the defaults and says saving is not yet possible.
    if (b.error || d.error) setErr("שמירת עיצובים תתאפשר אחרי החלת המיגרציה 20261029080000. אפשר כבר לעיין בהצעות.");
    setBrand((b.data as BrandRow | null) ?? EMPTY_BRAND);
    setDesigns((d.data as DesignRow[] | null) ?? []);
  }, [firmId]);
  // Initial fetch; setState happens after the awaited queries resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); void loadBusiness(firmId).then((x) => { setProfile(x.profile); setAddresses(x.addresses); }); }, [firmId, load]);

  const logoSrc = brand.logo_data_url ?? DEFAULT_LOGO;
  useEffect(() => { analyseLogo(logoSrc).then(setColours).catch(() => setColours({ colours: [], neutral: true })); }, [logoSrc]);

  const issuer: RenderIssuer = useMemo(() => {
    const a = addressOn(addresses, "PUBLIC", new Date().toISOString().slice(0, 10));
    return {
      name: profile?.legalName ?? firmName, taxId: profile?.taxId ?? "", entity: profile?.entityType ?? "INDIVIDUAL",
      address: a ? `${a.street} ${a.houseNum}, ${a.city}` : "", phone: brand.phone, email: brand.email, website: brand.website,
    };
  }, [profile, addresses, firmName, brand.phone, brand.email, brand.website]);
  const renderBrand: RenderBrand = { logoUrl: logoSrc, logoAlt: issuer.name, bank: brand.bank, footerNote: brand.footer_note };

  const drafts = useMemo(() => docs.filter((d) => d.status === "DRAFT" && d.doc_type === docType && !d.is_test).slice(0, 20), [docs, docType]);
  const subject: { customer: RenderCustomer; doc: RenderDoc } = useMemo(() => {
    const d = drafts.find((x) => x.id === source);
    if (!d) return sampleDoc(docType);
    const c = customers.find((x) => x.id === d.customer_id);
    return {
      customer: { name: c?.name ?? "", taxId: c?.tax_id ?? null, address: [c?.address, c?.city].filter(Boolean).join(", ") || null, email: c?.email ?? null },
      doc: {
        docType, number: null, issueDate: d.issue_date, dueDate: d.due_date, subject: d.subject, lines: d.lines, subtotal: Number(d.subtotal),
        vatRate: Number(d.vat_rate), vatAmount: Number(d.vat_amount), total: Number(d.total),
        payments: d.payment_method ? [{ method: PAY_METHOD[d.payment_method], date: d.issue_date, amount: Number(d.total), ref: d.payment_ref }] : [],
      },
    };
  }, [drafts, source, customers, docType]);

  const suggestions: Suggestion[] = useMemo(() => suggestDesigns(answers, colours, page), [answers, colours, page]);
  const thumb = (s: DesignSpec) => { const x = sampleDoc("INVOICE"); return renderDocument(s, renderBrand, issuer, x.customer, x.doc, { mode: "sample" }); };
  const previewHtml = renderDocument(spec, renderBrand, issuer, subject.customer, subject.doc, { mode: source === "sample" ? "sample" : "preview" });
  const problems = checkDesign(spec);
  const set = <K extends keyof DesignSpec>(k: K, v: DesignSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));

  function onLogo(file: File | undefined) {
    setMsg(""); setErr("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) { setErr("הלוגו צריך להיות PNG, JPG, WebP, GIF או SVG."); return; }
    if (file.size > MAX_LOGO_BYTES) { setErr("הלוגו גדול מ-300KB. שמרו אותו בגודל קטן יותר ונסו שוב."); return; }
    const r = new FileReader();
    r.onload = () => { setBrand((b) => ({ ...b, logo_data_url: String(r.result) })); setBrandDirty(true); setPage(0); };
    r.readAsDataURL(file);
  }
  async function saveBrand() {
    if (!supabase) return;
    setMsg(""); setErr("");
    const bank = brand.bank && (brand.bank.bank || brand.bank.account) ? brand.bank : null;
    const { error } = await supabase.rpc("lalum_fin_doc_brand_set", { p_firm: firmId, p_logo: brand.logo_data_url ?? "", p_phone: brand.phone ?? "", p_email: brand.email ?? "", p_website: brand.website ?? "", p_bank: bank, p_footer: brand.footer_note ?? "" });
    if (error) { setErr("פרטי המותג לא נשמרו. " + error.message); return; }
    setBrandDirty(false); setMsg("פרטי המותג נשמרו.");
  }
  async function saveDesign() {
    if (!supabase) return;
    setMsg(""); setErr("");
    if (problems.length) { setErr("לא ניתן לשמור: " + problems.join("; ")); return; }
    const name = editing.name.trim() || `${LAYOUTS[spec.layout]} ${new Date().toLocaleDateString("he-IL")}`;
    const { data, error } = await supabase.rpc("lalum_fin_doc_design_save", { p_firm: firmId, p_id: editing.id, p_name: name, p_spec: spec, p_default_for: editing.defaults });
    if (error) { setErr("העיצוב לא נשמר. " + error.message); return; }
    setEditing((e) => ({ ...e, id: String(data), name }));
    setMsg("העיצוב נשמר.");
    void load();
  }
  async function archive(id: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_fin_doc_design_archive", { p_id: id });
    if (error) { setErr("העיצוב לא הועבר לארכיון. " + error.message); return; }
    if (editing.id === id) setEditing({ id: null, name: "", defaults: [] });
    void load();
  }
  async function downloadI4u() {
    setErr("");
    try {
      const url = await invoice4uLogo(logoSrc);
      const a = document.createElement("a");
      a.href = url; a.download = "logo-invoice4u.jpg";
      document.body.appendChild(a); a.click(); a.remove();
    } catch { setErr("לא הצלחנו להכין את קובץ הלוגו."); }
  }
  const pick = (s: Suggestion) => { setSpec(s.spec); setEditing({ id: null, name: s.name, defaults: [] }); setMsg(""); };
  const open = (d: DesignRow) => { setSpec(parseSpec(d.spec)); setEditing({ id: d.id, name: d.name, defaults: d.default_for }); setMsg(""); };

  return (
    <div className="ck-stack">
      <div className="ck-warn">
        <b>מה העיצוב כאן משנה, ומה לא.</b> המסמך החוקי שהלקוח מקבל (חשבונית מס, קבלה, חשבון עסקה) מופק ונחתם דיגיטלית במערכת ההנפקה, Invoice4U, בעיצוב שנקבע בהגדרות שלה.
        העיצוב שנבחר כאן משמש לתצוגה מקדימה ולדוגמאות, ויהיה העיצוב של המסמך עצמו כשההנפקה תעבור למנוע העצמאי. כדי שגם המסמך של Invoice4U יתאים, ראו "התאמה ב-Invoice4U" למטה.
      </div>
      {!profile && <div className="ck-meta">פרופיל העסק (שם, מספר עוסק, כתובת) עוד לא מולא, לכן הדוגמאות מציגות את שם הפירמה בלבד.</div>}
      {err && <div className="ck-err" aria-live="polite">{err}</div>}
      {msg && <div className="ck-meta" aria-live="polite">{msg}</div>}

      <div className="ck-card ck-stack">
        <div className="ck-title">1. לוגו ופרטי מותג</div>
        <div className="ck-row" style={{ alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <img src={logoSrc} alt="הלוגו הנוכחי" style={{ height: 48, maxWidth: 260, objectFit: "contain", background: "#fff", padding: 6, borderRadius: 6 }} />
          <label className="ck-btn sm">החלפת לוגו<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden disabled={!canEdit} onChange={(e) => onLogo(e.target.files?.[0])} /></label>
          {brand.logo_data_url && <button className="ck-btn sm" disabled={!canEdit} onClick={() => { setBrand((b) => ({ ...b, logo_data_url: null })); setBrandDirty(true); }}>חזרה ללוגו הרשמי</button>}
          <span className="ck-meta">
            {colours.neutral ? "הלוגו בלי צבע משלו, לכן ההצעות משתמשות בפלטות תואמות." : <>צבעי הלוגו: {colours.colours.map((c) => <span key={c} title={c} style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: c, marginInlineStart: 4, verticalAlign: "middle" }} />)}</>}
          </span>
        </div>
        <div className="ck-grid2">
          <label className="ck-field"><span className="ck-label">טלפון</span><input className="ck-input" dir="ltr" value={brand.phone ?? ""} disabled={!canEdit} onChange={(e) => { setBrand({ ...brand, phone: e.target.value }); setBrandDirty(true); }} /></label>
          <label className="ck-field"><span className="ck-label">דוא"ל</span><input className="ck-input" dir="ltr" value={brand.email ?? ""} disabled={!canEdit} onChange={(e) => { setBrand({ ...brand, email: e.target.value }); setBrandDirty(true); }} /></label>
          <label className="ck-field"><span className="ck-label">אתר</span><input className="ck-input" dir="ltr" value={brand.website ?? ""} disabled={!canEdit} onChange={(e) => { setBrand({ ...brand, website: e.target.value }); setBrandDirty(true); }} /></label>
          <label className="ck-field"><span className="ck-label">שורת סיום (עד 300 תווים)</span><input className="ck-input" maxLength={300} value={brand.footer_note ?? ""} disabled={!canEdit} onChange={(e) => { setBrand({ ...brand, footer_note: e.target.value }); setBrandDirty(true); }} /></label>
          {(["bank", "branch", "account"] as const).map((k) => (
            <label key={k} className="ck-field"><span className="ck-label">{{ bank: "בנק", branch: "סניף", account: "מספר חשבון" }[k]}</span>
              <input className="ck-input" value={brand.bank?.[k] ?? ""} disabled={!canEdit} onChange={(e) => { setBrand({ ...brand, bank: { bank: "", branch: "", account: "", ...brand.bank, [k]: e.target.value } }); setBrandDirty(true); }} /></label>
          ))}
        </div>
        <div className="ck-row"><button className="ck-btn primary" disabled={!canEdit || !brandDirty} onClick={() => void saveBrand()}>שמירת פרטי המותג</button></div>
      </div>

      <div className="ck-card ck-stack">
        <div className="ck-title">2. כמה שאלות</div>
        {QUESTIONS.map((q) => (
          <div key={q.key} className="ck-stack" style={{ gap: 6 }}>
            <div className="ck-label">{q.q}</div>
            <div className="fin-seg" role="group" aria-label={q.q} style={{ flexWrap: "wrap" }}>
              {q.options.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={answers[q.key] === v} onClick={() => { setAnswers({ ...answers, [q.key]: v } as Answers); setPage(0); }}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ck-card ck-stack">
        <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="ck-title">3. הצעות {page > 0 && <span className="ck-meta">(סבב {page + 1})</span>}</div>
          <div className="ck-row">
            {page > 0 && <button className="ck-btn sm" onClick={() => setPage((p) => p - 1)}>הקודמות</button>}
            <button className="ck-btn sm" onClick={() => setPage((p) => p + 1)}>הצעות נוספות</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
          {suggestions.map((s) => (
            <div key={s.key} className="ck-stack" style={{ gap: 6, alignItems: "center" }}>
              <Page html={thumb(s.spec)} scale={0.235} title={s.name} />
              <div style={{ fontWeight: 600, textAlign: "center" }}>{s.name}</div>
              <div className="ck-meta" style={{ textAlign: "center" }}>{s.why}. <bdi>{s.fonts[0]}</bdi>{s.fonts[1] && <> עם <bdi>{s.fonts[1]}</bdi></>}</div>
              <button className="ck-btn sm" aria-pressed={spec === s.spec} onClick={() => pick(s)}>בחירה וכוונון</button>
            </div>
          ))}
        </div>
      </div>

      <div className="ck-card ck-stack">
        <div className="ck-title">4. כוונון ותצוגה מקדימה {editing.id && <span className="ck-meta">(עריכת "{editing.name}")</span>}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <div className="ck-stack" style={{ gap: 10, flex: "1 1 260px", maxWidth: 360 }}>
            <label className="ck-field"><span className="ck-label">פריסה</span>
              <select className="ck-select" value={spec.layout} onChange={(e) => set("layout", e.target.value as DesignSpec["layout"])}>{Object.entries(LAYOUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="ck-row" style={{ gap: 12 }}>
              <label className="ck-field"><span className="ck-label">צבע ראשי</span><input type="color" value={spec.palette.primary} onChange={(e) => set("palette", buildPalette(e.target.value, spec.palette.accent, { warmPaper: spec.palette.paper !== "#ffffff" }))} /></label>
              <label className="ck-field"><span className="ck-label">צבע משני</span><input type="color" value={spec.palette.accent} onChange={(e) => set("palette", buildPalette(spec.palette.primary, e.target.value, { warmPaper: spec.palette.paper !== "#ffffff" }))} /></label>
              <label className="ck-field"><span className="ck-label">נייר חם</span><input type="checkbox" checked={spec.palette.paper !== "#ffffff"} onChange={(e) => set("palette", buildPalette(spec.palette.primary, spec.palette.accent, { warmPaper: e.target.checked }))} /></label>
            </div>
            <div className="ck-row" style={{ gap: 6, flexWrap: "wrap" }}>
              {[...colours.colours, ...CURATED.map((c) => c.primary)].slice(0, 9).map((c) => (
                <button key={c} type="button" title={c} aria-label={`צבע ${c}`} onClick={() => set("palette", buildPalette(c, spec.palette.accent))} style={{ width: 22, height: 22, borderRadius: 4, background: c, border: "1px solid rgba(0,0,0,.2)", cursor: "pointer" }} />
              ))}
            </div>
            {(["heading", "body"] as const).map((k) => (
              <label key={k} className="ck-field"><span className="ck-label">{k === "heading" ? "גופן כותרות" : "גופן טקסט"}</span>
                <select className="ck-select" value={spec.fonts[k]} onChange={(e) => set("fonts", { ...spec.fonts, [k]: e.target.value as FontKey })}>
                  {Object.entries(FONTS).filter(([, f]) => k === "heading" || !f.headingOnly).map(([fk, f]) => <option key={fk} value={fk}>{f.label}</option>)}
                </select></label>
            ))}
            <label className="ck-field"><span className="ck-label">טבלה</span>
              <select className="ck-select" value={spec.table} onChange={(e) => set("table", e.target.value as DesignSpec["table"])}><option value="lines">קווים</option><option value="zebra">פסים</option><option value="boxed">משבצות</option></select></label>
            <label className="ck-field"><span className="ck-label">צפיפות</span>
              <select className="ck-select" value={spec.density} onChange={(e) => set("density", e.target.value as DesignSpec["density"])}><option value="airy">מרווחת</option><option value="regular">רגילה</option><option value="compact">צפופה</option></select></label>
            <div className="ck-row" style={{ gap: 12, flexWrap: "wrap" }}>
              <label className="ck-field"><span className="ck-label">גודל לוגו</span>
                <select className="ck-select" value={spec.logo.size} onChange={(e) => set("logo", { ...spec.logo, size: e.target.value as DesignSpec["logo"]["size"] })}><option value="s">קטן</option><option value="m">בינוני</option><option value="l">גדול</option></select></label>
              <label className="ck-field"><span className="ck-label">מיקום</span>
                <select className="ck-select" value={spec.logo.placement} onChange={(e) => set("logo", { ...spec.logo, placement: e.target.value as DesignSpec["logo"]["placement"] })}><option value="start">ימין</option><option value="center">מרכז</option><option value="end">שמאל</option></select></label>
              <label className="ck-field"><span className="ck-label">צבע הלוגו</span>
                <select className="ck-select" value={spec.logo.treatment} onChange={(e) => set("logo", { ...spec.logo, treatment: e.target.value as DesignSpec["logo"]["treatment"] })}><option value="original">מקורי</option><option value="mono">שחור</option><option value="inverse">לבן</option></select></label>
            </div>
            <label className="ck-field"><span className="ck-label">פינות</span>
              <select className="ck-select" value={spec.corners} onChange={(e) => set("corners", Number(e.target.value) as DesignSpec["corners"])}><option value={0}>ישרות</option><option value={4}>מעוגלות מעט</option><option value={10}>מעוגלות</option></select></label>
            <label className="ck-row" style={{ gap: 8 }}><input type="checkbox" checked={spec.showBank} onChange={(e) => set("showBank", e.target.checked)} /> פרטי בנק מתחת לסיכום</label>
            {problems.length > 0 && <div className="ck-warn">{problems.join(". ")}.</div>}
            <hr style={{ width: "100%", opacity: .3 }} />
            <label className="ck-field"><span className="ck-label">שם העיצוב</span><input className="ck-input" maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <div className="ck-stack" style={{ gap: 4 }}><span className="ck-label">ברירת מחדל עבור</span>
              {TYPES.map((t) => (
                <label key={t} className="ck-row" style={{ gap: 8 }}><input type="checkbox" checked={editing.defaults.includes(t)} onChange={(e) => setEditing({ ...editing, defaults: e.target.checked ? [...editing.defaults, t] : editing.defaults.filter((x) => x !== t) })} /> {DOC_TYPE[t]}</label>
              ))}</div>
            <div className="ck-row"><button className="ck-btn primary" disabled={!canEdit || problems.length > 0} onClick={() => void saveDesign()}>{editing.id ? "שמירת השינויים" : "שמירה כעיצוב חדש"}</button>
              {editing.id && <button className="ck-btn" onClick={() => setEditing({ id: null, name: editing.name + " (עותק)", defaults: [] })}>שמירה כעותק</button>}</div>
          </div>
          <div className="ck-stack" style={{ gap: 10, alignItems: "center", flex: "1 1 500px" }}>
            <div className="ck-row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="ck-select" aria-label="סוג מסמך" value={docType} onChange={(e) => { setDocType(e.target.value as RenderDocType); setSource("sample"); }}>{TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE[t]}</option>)}</select>
              <select className="ck-select" aria-label="על מה להציג" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="sample">נתוני דוגמה</option>
                {drafts.map((d) => <option key={d.id} value={d.id}>טיוטה: {customers.find((c) => c.id === d.customer_id)?.name ?? ""} {d.issue_date}</option>)}
              </select>
              <button className="ck-btn sm" onClick={() => preview.current?.contentWindow?.print()}>הדפסה או PDF (עם סימן מים)</button>
            </div>
            <div style={{ width: PAGE_W * 0.62, height: PAGE_H * 0.62, overflow: "hidden", borderRadius: 6, boxShadow: "0 1px 6px rgba(0,0,0,.2)", background: "#fff", maxWidth: "100%" }}>
              <iframe ref={preview} title="תצוגה מקדימה" srcDoc={previewHtml} sandbox="allow-same-origin allow-modals"
                style={{ width: PAGE_W, height: PAGE_H, border: 0, transform: "scale(0.62)", transformOrigin: "top right" }} />
            </div>
          </div>
        </div>
      </div>

      {designs.length > 0 && (
        <div className="ck-card ck-stack">
          <div className="ck-title">עיצובים שמורים</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th>פריסה</th><th>ברירת מחדל עבור</th><th>עודכן</th><th /></tr></thead><tbody>
            {designs.map((d) => { const s = parseSpec(d.spec); return (
              <tr key={d.id}><td>{d.name}</td><td>{LAYOUTS[s.layout]}</td><td>{d.default_for.map((t) => DOC_TYPE[t as RenderDocType] ?? t).join(", ") || "אין"}</td><td>{d.updated_at.slice(0, 10)}</td>
                <td className="fin-actions-cell"><button className="ck-btn sm" onClick={() => open(d)}>פתיחה</button> <button className="ck-btn sm danger" disabled={!canEdit} onClick={() => void archive(d.id)}>לארכיון</button></td></tr>); })}
          </tbody></table></div>
        </div>
      )}

      <div className="ck-card ck-stack">
        <div className="ck-title">התאמה ב-Invoice4U</div>
        <div className="ck-meta">מערכת ההנפקה מאפשרת לבחור תבנית, צבע ולוגו בהגדרות החשבון בלבד, לכל המסמכים יחד. לא מצאנו דרך לקבוע עיצוב לכל מסמך דרך הממשק שלה. צעדים חד פעמיים:</div>
        <ol style={{ margin: 0, paddingInlineStart: 20 }}>{invoice4uHints(spec).map((h) => <li key={h}>{h}</li>)}</ol>
        <div className="ck-row"><button className="ck-btn" onClick={() => void downloadI4u()}>הורדת הלוגו בפורמט של Invoice4U (JPG)</button></div>
      </div>
    </div>
  );
}
