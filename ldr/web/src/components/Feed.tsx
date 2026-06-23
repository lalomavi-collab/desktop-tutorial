import { useEffect, useState } from "react";
import { supabase, type Profile, type Post } from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

const POST_SELECT =
  "*, author:ldr_profiles!author_id(display_name,reputation,verification_status,experience_tier,headline,avatar_url), likes:ldr_post_likes(count)";

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "עכשיו";
  const m = Math.floor(s / 60); if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60); if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.floor(h / 24); return `לפני ${d} ימים`;
}

function FeedSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card pad">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line shorter" style={{ marginTop: 6 }} />
            </div>
          </div>
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" style={{ marginTop: 6 }} />
          <div className="skeleton skeleton-line shorter" style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

export default function Feed({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_posts").select(POST_SELECT)
      .order("created_at", { ascending: false }).limit(60);
    const list = (data as Post[]) ?? [];
    setPosts(list);
    if (list.length) {
      const { data: mine } = await supabase.from("ldr_post_likes")
        .select("post_id").eq("user_id", profile.id).in("post_id", list.map((p) => p.id));
      setLiked(new Set((mine ?? []).map((r: any) => r.post_id)));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function publish() {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ldr_posts").insert({ author_id: profile.id, body: body.trim() });
    setBusy(false);
    if (error) { notify("שגיאה בפרסום: " + error.message); return; }
    setBody("");
    notify("הפוסט פורסם 📣");
    load();
  }

  async function toggleLike(p: Post) {
    const isLiked = liked.has(p.id);
    setLiked((prev) => { const n = new Set(prev); isLiked ? n.delete(p.id) : n.add(p.id); return n; });
    setPosts((prev) => prev.map((x) => x.id === p.id
      ? { ...x, likes: [{ count: (x.likes?.[0]?.count ?? 0) + (isLiked ? -1 : 1) }] } : x));
    if (isLiked) {
      await supabase.from("ldr_post_likes").delete().eq("post_id", p.id).eq("user_id", profile.id);
    } else {
      await supabase.from("ldr_post_likes").insert({ post_id: p.id, user_id: profile.id });
    }
  }

  async function remove(p: Post) {
    await supabase.from("ldr_posts").delete().eq("id", p.id);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
    notify("הפוסט נמחק");
  }

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 680 }}>
      <div className="section-header">
        <h2>הפיד המקצועי</h2>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>שתפו תובנות, שאלות וחדשות עם קהילת עורכי הדין.</p>

      {/* Compose box */}
      <div className="card pad" style={{ marginBottom: 18, borderColor: "rgba(212,175,55,0.22)" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Avatar name={profile.display_name} size={44} verified={profile.verification_status === "verified"} url={profile.avatar_url} />
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="על מה תרצו לדבר? תובנה משפטית, שאלה לקהילה, עדכון מקצועי…"
            style={{ flex: 1, minHeight: 80, resize: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) publish(); }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 12 }}>Ctrl+Enter לפרסום מהיר</span>
          <button className="btn btn-gold" disabled={busy || !body.trim()} onClick={publish}
            style={{ padding: "9px 20px", fontSize: 14 }}>
            {busy ? <span className="spinner" /> : "📣 פרסום"}
          </button>
        </div>
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <div className="card pad center" style={{ marginTop: 14, padding: "40px 22px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
          <p className="muted">הפיד ריק עדיין — היו הראשונים לשתף תובנה.</p>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((p) => {
            const rp = rankFor(p.author?.reputation ?? 0);
            const count = p.likes?.[0]?.count ?? 0;
            const isLiked = liked.has(p.id);
            return (
              <div key={p.id} className="card pad card-interactive">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={p.author?.display_name ?? null} size={44}
                    verified={p.author?.verification_status === "verified"} url={p.author?.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {p.author?.display_name || "עו״ד"}
                      {p.author?.verification_status === "verified" && (
                        <span className="tag tag-gold" style={{ fontSize: 10, padding: "2px 7px" }}>✓ מאומת</span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                      <span className="rank-badge" style={{ fontSize: 10, padding: "2px 8px" }}>{rp.rank.icon} {rp.rank.title}</span>
                      <span>·</span>
                      <span>{ago(p.created_at)}</span>
                    </div>
                  </div>
                  {p.author_id === profile.id && (
                    <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 12, borderRadius: 8 }}
                      onClick={() => remove(p)} title="מחיקה">✕</button>
                  )}
                </div>

                <p style={{ lineHeight: 1.75, margin: "14px 0 12px", whiteSpace: "pre-wrap", fontSize: 15 }}>{p.body}</p>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className={`btn-like${isLiked ? " liked" : ""}`}
                    onClick={() => toggleLike(p)}
                  >
                    {isLiked ? "❤️" : "🤍"} {count > 0 ? count : ""}
                    <span style={{ marginRight: 4, fontSize: 12 }}>
                      {isLiked ? "אהבתי" : "אהבתי"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
