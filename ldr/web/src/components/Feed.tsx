import { useEffect, useState } from "react";
import { supabase, type Profile, type Post } from "../lib/supabase";
import { rankFor } from "../lib/reputation";
import Avatar from "./Avatar";

const POST_SELECT =
  "*, author:ldr_profiles!author_id(display_name,reputation,verification_status,experience_tier,headline), likes:ldr_post_likes(count)";

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "עכשיו";
  const m = Math.floor(s / 60); if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60); if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.floor(h / 24); return `לפני ${d} ימים`;
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
    // optimistic
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
  }

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 680 }}>
      <h2 style={{ margin: 0 }}>הפיד המקצועי</h2>
      <p className="muted">שתפו תובנות, שאלות וחדשות עם קהילת עורכי הדין.</p>

      <div className="card pad">
        <div style={{ display: "flex", gap: 12 }}>
          <Avatar name={profile.display_name} size={44} verified={profile.verification_status === "verified"} />
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="על מה תרצו לדבר? תובנה משפטית, שאלה לקהילה, עדכון…"
            style={{ flex: 1, minHeight: 70 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button className="btn btn-gold" disabled={busy || !body.trim()} onClick={publish}>
            {busy ? <span className="spinner" /> : "פרסום"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : posts.length === 0 ? (
        <div className="card pad center" style={{ marginTop: 14 }}>
          <p className="muted">הפיד ריק עדיין — היו הראשונים לשתף תובנה.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {posts.map((p) => {
            const rp = rankFor(p.author?.reputation ?? 0);
            const count = p.likes?.[0]?.count ?? 0;
            const isLiked = liked.has(p.id);
            return (
              <div key={p.id} className="card pad">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={p.author?.display_name ?? null} size={44}
                    verified={p.author?.verification_status === "verified"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {p.author?.display_name || "עו״ד"}
                      {p.author?.verification_status === "verified" && <span className="tag" style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }} dir="ltr">
                      {rp.rank.icon} {rp.rank.title} · {ago(p.created_at)}
                    </div>
                  </div>
                  {p.author_id === profile.id && (
                    <button className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={() => remove(p)} title="מחיקה">✕</button>
                  )}
                </div>
                <p style={{ lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-wrap" }}>{p.body}</p>
                <button
                  className={"btn btn-ghost"} onClick={() => toggleLike(p)}
                  style={{ color: isLiked ? "var(--gold)" : undefined }}
                >
                  {isLiked ? "👍 אהבתי" : "👍 אהבתי"} {count > 0 && `· ${count}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
