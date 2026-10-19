// Password policy and strength, for the pages that choose a NEW password (sign up,
// reset, change). Sign in never applies it: a password set under an older rule
// must still work.
//
// The policy follows NIST SP 800-63B rather than the older composition rules:
// length first, no forced symbols or digits, and a block on passwords that are
// known to be guessed first. What is checked, and why:
//   length       at least MIN_LENGTH characters. Length is what slows guessing.
//   not common   not on a list of the passwords attackers try first (after undoing
//                the usual substitutions, p@ssw0rd becoming password).
//   not personal does not contain the account's own email or name.
//   no pattern   not a run of one character, a short unit repeated, or a keyboard
//                or alphabet sequence that makes up most of the password.
//   max length   at most MAX_BYTES. Supabase Auth hashes with bcrypt, which silently
//                ignores everything after the 72nd byte, so a longer password would
//                look stronger than it is.
// A password that was exposed in a public breach is checked separately, against
// the Pwned Passwords range API (see pwnedCheck.ts), because that needs the network.
//
// The strength score is a rough estimate for the meter, not a guarantee: it cannot
// know whether a password was chosen at random. A password the app generated is
// scored as strong because it was drawn from the Web Crypto generator.

export const MIN_LENGTH = 12;
export const MAX_BYTES = 72;

// The passwords attackers try first, and a few that belong to this practice. Kept short
// on purpose: it is a floor for the meter, and the breach check does the heavy lifting.
const COMMON = new Set(
  `password passw0rd pass1234 password1 password12 password123 password1234 123456 1234567 12345678 123456789 1234567890 12345 1234
   qwerty qwerty123 qwertyuiop qwertyui asdfgh asdfghjkl zxcvbnm 1q2w3e4r 1q2w3e 1qaz2wsx zaq12wsx abc123 abcd1234 abcdef abcdefg
   iloveyou iloveu ilovemyself letmein welcome welcome1 welcome123 admin admin123 administrator root toor login master hello hello123
   monkey dragon football baseball soccer hockey basketball sunshine princess shadow superman batman spiderman starwars pokemon
   trustno1 whatever freedom secret secret123 mustang ninja michael jordan jennifer jessica ashley charlie daniel thomas
   shalom shalom123 israel israel123 telaviv jerusalem yerushalayim sababa yalla toda todaraba mashehu aliyah matan
   lalum lalumapp lalum123 lalum2026 avraham avi123 lawyer lawyers attorney lawfirm client client123 contract contracts
   changeme changeit default guest test test123 testtest demo demo123 temp temp123 qazwsx qazwsxedc q1w2e3r4 p@ssw0rd
   summer winter spring autumn january february march april june july august september october november december
   2020 2021 2022 2023 2024 2025 2026 2027 000000 111111 121212 123123 123321 654321 666666 696969 7777777 987654321 aaaaaa`
    .split(/\s+/)
    .filter(Boolean),
);

const LEET: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "l" };

/** Lowercase, undo common character swaps, keep letters and digits only. */
function normalise(pw: string): string {
  let out = "";
  for (const ch of pw.toLowerCase()) {
    const m = LEET[ch] ?? ch;
    if (/[\p{L}\p{N}]/u.test(m)) out += m;
  }
  return out;
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "abcdefghijklmnopqrstuvwxyz", "שדגכעיחלךף", "קראטוןםפ", "זסבהנמצתץ"];

function longestRunInRows(s: string): number {
  let best = 0;
  for (const row of ROWS) {
    for (const seq of [row, [...row].reverse().join("")]) {
      for (let i = 0; i < s.length; i++) {
        let n = 0;
        while (i + n < s.length) {
          const at = seq.indexOf(s[i + n]);
          if (at < 0) break;
          if (n === 0) {
            n = 1;
            continue;
          }
          // the next character must follow the previous one in the row
          const prevAt = seq.indexOf(s[i + n - 1]);
          if (at !== prevAt + 1) break;
          n++;
        }
        best = Math.max(best, n);
      }
    }
  }
  return best;
}

function isRepeatedUnit(s: string): boolean {
  for (let unit = 1; unit <= 4; unit++) {
    if (s.length < unit * 3) continue;
    const u = s.slice(0, unit);
    if (u.repeat(Math.ceil(s.length / unit)).slice(0, s.length) === s) return true;
  }
  return false;
}

/** True when the password is mostly one character, a short unit repeated, or a keyboard or alphabet run. */
function hasWeakPattern(pw: string): boolean {
  const s = pw.toLowerCase();
  if (isRepeatedUnit(s)) return true;
  const plain = s.replace(/[^\p{L}\p{N}]/gu, "");
  if (plain.length >= 6 && longestRunInRows(plain) >= Math.max(6, Math.ceil(plain.length * 0.6))) return true;
  // one character making up most of the password
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return Math.max(...counts.values()) >= Math.ceil(s.length * 0.7) && s.length >= 6;
}

function isCommon(pw: string): boolean {
  const lower = pw.toLowerCase();
  // letters and digits only, and the same with the usual character swaps undone
  const plain = lower.replace(/[^\p{L}\p{N}]/gu, "");
  const leet = normalise(pw);
  if ([lower, plain, leet].some((c) => c && COMMON.has(c))) return true;
  // a common word with digits or symbols added after it: password2026, welcome1!
  const stripped = lower.replace(/[\d\p{P}\p{S}]+$/u, "");
  if (stripped.length >= 4 && stripped !== lower && (COMMON.has(stripped) || COMMON.has(normalise(stripped)))) return true;
  // a common word of 6 or more letters, repeated or followed by digits: passwordpassword, monkey2026
  for (const w of COMMON) {
    if (w.length < 6 || !/^[a-z]+$/.test(w)) continue;
    for (const c of [plain, leet]) {
      if (!c.startsWith(w)) continue;
      const rest = c.slice(w.length);
      if (rest === "" || /^\d+$/.test(rest) || rest.startsWith(w)) return true;
      // ... or followed by a keyboard, digit or alphabet run: password1234567890abcdef
      if (rest.length >= 4 && longestRunInRows(rest) >= Math.ceil(rest.length * 0.6)) return true;
    }
  }
  return false;
}

function personalTokens(ctx: { email?: string; name?: string }): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    for (const part of raw.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const n = normalise(part);
      if (n.length >= 4) out.add(n);
    }
  };
  if (ctx.email) {
    const [local, domain] = ctx.email.split("@");
    if (local) add(local);
    if (domain) add(domain.split(".")[0] ?? "");
  }
  if (ctx.name) add(ctx.name);
  return [...out];
}

function containsPersonal(pw: string, ctx: { email?: string; name?: string }): boolean {
  const n = normalise(pw);
  return personalTokens(ctx).some((t) => n.includes(t));
}

type RunKind = "lower" | "upper" | "digit" | "symbol" | "other";

function kindOf(ch: string): RunKind {
  if (/[a-z]/.test(ch)) return "lower";
  if (/[A-Z]/.test(ch)) return "upper";
  if (/\d/.test(ch)) return "digit";
  if (/[^\p{ASCII}]/u.test(ch)) return /\p{L}/u.test(ch) ? "other" : "symbol";
  return "symbol";
}

/**
 * A conservative estimate of the bits a guesser would need, from runs of the same kind of
 * character rather than from the alphabet. Words are the point: "orchardviolinsparrow" draws on
 * the same 26 letters as random text but is guessed as three words, so a long run of letters is
 * counted at about 2.3 bits each (a word from a large list), and only short, mixed runs are
 * counted as if random. Repeats of a separator cost little. This under-rates a truly random
 * lowercase string, which is the safe direction for a meter.
 */
function estimateBits(pw: string): number {
  const chars = [...pw];
  const runs: { kind: RunKind; text: string }[] = [];
  for (const ch of chars) {
    const k = kindOf(ch);
    const last = runs[runs.length - 1];
    if (last && last.kind === k) last.text += ch;
    else runs.push({ kind: k, text: ch });
  }
  const seenSymbols = new Set<string>();
  let bits = 0;
  runs.forEach((r, i) => {
    const n = [...r.text].length;
    const next = runs[i + 1];
    if (r.kind === "lower" || r.kind === "other") {
      bits += n >= 10 ? n * 2.8 : n >= 4 ? n * 2.3 : n * 4.2;
    } else if (r.kind === "upper") {
      // a capital that starts a word is nearly free; an all capitals word counts like a lowercase one
      if (n === 1 && next && (next.kind === "lower" || next.kind === "other") && [...next.text].length >= 3) bits += 1.5;
      else bits += n >= 4 ? n * 2.3 : n * 4.2;
    } else if (r.kind === "digit") {
      bits += n * 3;
    } else {
      for (const ch of r.text) {
        bits += seenSymbols.has(ch) ? 1 : 3.5;
        seenSymbols.add(ch);
      }
    }
  });
  return bits;
}

export interface PasswordRules {
  length: boolean;
  notCommon: boolean;
  notPersonal: boolean;
  noPattern: boolean;
  withinMax: boolean;
}

export interface PasswordReport {
  /** 0 very weak, 1 weak, 2 fair, 3 good, 4 strong. */
  score: 0 | 1 | 2 | 3 | 4;
  /** A deliberately conservative estimate, in bits. */
  bits: number;
  rules: PasswordRules;
  /** Every rule holds. The only gate the form applies. */
  ok: boolean;
}

export function byteLength(pw: string): number {
  return new TextEncoder().encode(pw).length;
}

/**
 * Evaluate a password that is about to be chosen.
 * `generated` marks a password the app drew from the Web Crypto generator.
 */
export function evaluatePassword(pw: string, ctx: { email?: string; name?: string } = {}, opts: { generated?: boolean } = {}): PasswordReport {
  const rules: PasswordRules = {
    length: [...pw].length >= MIN_LENGTH,
    notCommon: pw.length === 0 ? false : !isCommon(pw),
    notPersonal: pw.length === 0 ? false : !containsPersonal(pw, ctx),
    noPattern: pw.length === 0 ? false : !hasWeakPattern(pw),
    withinMax: byteLength(pw) <= MAX_BYTES,
  };
  const ok = pw.length > 0 && Object.values(rules).every(Boolean);

  const bits = Math.round(estimateBits(pw));
  let score: PasswordReport["score"] = bits < 28 ? 0 : bits < 40 ? 1 : bits < 52 ? 2 : bits < 68 ? 3 : 4;
  if (pw.length === 0) score = 0;
  // Known-bad or patterned never rises above weak, however long it is.
  if (!rules.notCommon || !rules.noPattern || !rules.notPersonal) score = Math.min(score, 1) as PasswordReport["score"];
  if (opts.generated && ok) score = 4;
  return { score, bits, rules, ok };
}
