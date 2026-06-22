// Reputation ranks, level progress, and achievement badges.
// Reputation/counters live in ldr_profiles; this is the gamification layer on top.

export interface Rank {
  level: number;
  title: string;
  icon: string;
  min: number;
}

// Ascending reputation thresholds → gamified titles (Stack-Overflow style ladder).
export const RANKS: Rank[] = [
  { level: 1, title: "מתלמד", icon: "🌱", min: 0 },
  { level: 2, title: "תורם", icon: "📘", min: 50 },
  { level: 3, title: "מנתח", icon: "📊", min: 150 },
  { level: 4, title: "מומחה", icon: "🎯", min: 400 },
  { level: 5, title: "סמכות", icon: "🏅", min: 900 },
  { level: 6, title: "אורקל", icon: "🏛️", min: 2000 },
];

export interface RankProgress {
  rank: Rank;
  next: Rank | null;
  toNext: number; // reputation points remaining to next rank
  pct: number;    // progress within the current band, 0–100
}

export function rankFor(reputation: number): RankProgress {
  const r = Math.max(0, reputation || 0);
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (r >= RANKS[i].min) idx = i;
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  if (!next) return { rank, next: null, toNext: 0, pct: 100 };
  const span = next.min - rank.min;
  const pct = Math.min(100, Math.max(0, Math.round(((r - rank.min) / span) * 100)));
  return { rank, next, toNext: Math.max(0, next.min - r), pct };
}

export interface Badge {
  key: string;
  label: string;
  icon: string;
  hint: string;
  earned: boolean;
}

export interface BadgeInput {
  contribution_count: number;
  prediction_count: number;
  reputation: number;
}

export function badgesFor(p: BadgeInput): Badge[] {
  const c = p.contribution_count ?? 0;
  const pr = p.prediction_count ?? 0;
  const rep = p.reputation ?? 0;
  return [
    { key: "first_case", icon: "📂", label: "תיק ראשון", hint: "שיתוף תיק ראשון לחדר", earned: c >= 1 },
    { key: "contributor", icon: "📚", label: "תורם פעיל", hint: "10 תיקים ששותפו", earned: c >= 10 },
    { key: "prolific", icon: "🏗️", label: "בנאי הקהילה", hint: "30 תיקים ששותפו", earned: c >= 30 },
    { key: "first_vote", icon: "🗳️", label: "מצביע", hint: "חיזוי ראשון", earned: pr >= 1 },
    { key: "forecaster", icon: "🔮", label: "חוזה מנוסה", hint: "25 חיזויים", earned: pr >= 25 },
    { key: "wisdom", icon: "🧠", label: "חכמת הקהל", hint: "50 חיזויים", earned: pr >= 50 },
    { key: "pillar", icon: "🏛️", label: "עמוד הקהילה", hint: "500 נקודות מוניטין", earned: rep >= 500 },
  ];
}
