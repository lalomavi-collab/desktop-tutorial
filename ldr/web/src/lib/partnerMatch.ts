// AI Partner Match — client-side scoring engine that ranks candidate
// providers for a cross-border referral (mirrors the riskEngine.ts pattern:
// instant, explainable feedback in the browser, no round trip to ai-core).
import { PRACTICE_AREAS, JURISDICTION_LABELS, type Profile } from "./supabase";

export interface PartnerMatch {
  profile: Profile;
  score: number; // 0–100
  reasons: string[];
}

const TIER_WEIGHT: Record<string, number> = { senior: 12, mid: 7, junior: 3 };
const TIER_LABEL: Record<string, string> = { senior: "בכיר", mid: "מנוסה", junior: "ג׳וניור" };

// Infers likely practice areas from the free-text brief by matching its
// significant words against each area's Hebrew label.
function detectPracticeAreas(brief: string): string[] {
  const text = brief.trim().toLowerCase();
  if (!text) return [];
  return PRACTICE_AREAS
    .filter((a) => {
      const words = a.label.toLowerCase().split(/[^א-תa-z0-9]+/).filter((w) => w.length > 2);
      return words.some((w) => text.includes(w));
    })
    .map((a) => a.key);
}

export function matchPartners(
  candidates: Profile[],
  jurisdiction: string,
  brief: string,
  practiceArea?: string,
): PartnerMatch[] {
  const targetAreas = practiceArea ? [practiceArea] : detectPracticeAreas(brief);

  const results: PartnerMatch[] = candidates.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    if (p.jurisdiction && p.jurisdiction === jurisdiction) {
      score += 40;
      reasons.push(`פעיל/ה ב${JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}, תחום השיפוט המבוקש`);
    }

    const overlap = targetAreas.filter((a) => (p.practice_areas ?? []).includes(a));
    if (overlap.length) {
      score += Math.min(35, overlap.length * 20);
      const labels = overlap.map((a) => PRACTICE_AREAS.find((pa) => pa.key === a)?.label).filter(Boolean);
      reasons.push(`התמחות תואמת: ${labels.join(", ")}`);
    }

    const tierScore = p.experience_tier ? TIER_WEIGHT[p.experience_tier] ?? 0 : 0;
    if (tierScore) {
      score += tierScore;
      reasons.push(`דרגת ותק: ${TIER_LABEL[p.experience_tier as string]}`);
    }

    const repScore = Math.min(13, Math.round(((p.reputation ?? 0) / 2000) * 13));
    if (repScore >= 5) {
      score += repScore;
      reasons.push(`מוניטין קהילתי גבוה (${p.reputation} נק')`);
    }

    if (!reasons.length) reasons.push("אין עדיין נתונים מספיקים להתאמה מדויקת");

    return { profile: p, score: Math.max(0, Math.min(100, Math.round(score))), reasons };
  });

  return results.sort((a, b) => b.score - a.score);
}
