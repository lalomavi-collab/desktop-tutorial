// Checks a password against the HaveIBeenPwned "Pwned Passwords" range API using
// k-anonymity: only the first 5 characters of the password's SHA-1 hash ever
// leave the browser, so the plaintext (and even the full hash) is never sent.
// This reproduces Supabase Auth's leaked-password protection (a Pro-plan
// feature) at no cost, on any plan.
//
// Returns the number of times the password appears in known breaches (0 means
// not found). It fails open (returns 0) on any network or crypto error, so an
// outage of the third-party service can never block a legitimate sign-up.

async function sha1Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function pwnedCount(password: string): Promise<number> {
  if (!password) return 0;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    // Add-Padding asks HIBP to pad the response with decoy entries, so the
    // number of real matches cannot be inferred from the response size.
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return 0;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [suf, count] = line.trim().split(":");
      // A padded decoy carries a count of 0; a real match carries the breach count.
      if (suf === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
