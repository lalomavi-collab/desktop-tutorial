// Checks the password policy and strength estimate used when a new password is chosen.
// Run with: npm run password-check
import assert from "node:assert/strict";
import { evaluatePassword, MIN_LENGTH, MAX_BYTES } from "../src/lib/passwordPolicy.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const ctx = { email: "avraham@lalum.co" };
const ok = (pw, c = ctx) => evaluatePassword(pw, c).ok;

t("the minimum length is 12 and the byte ceiling is 72", () => {
  assert.equal(MIN_LENGTH, 12);
  assert.equal(MAX_BYTES, 72);
});

t("short passwords fail on length only", () => {
  const r = evaluatePassword("Tq9!xv", ctx);
  assert.equal(r.rules.length, false);
  assert.equal(r.ok, false);
});

t("common passwords are rejected, including with swaps and digits", () => {
  for (const pw of ["password1234", "P@ssw0rd", "Password2026", "welcome123456", "iloveyou2026", "passwordpassword", "monkey2026", "qwertyuiop12"]) {
    assert.equal(ok(pw), false, pw);
  }
});

t("patterns are rejected: repeats, sequences and keyboard runs", () => {
  for (const pw of ["aaaaaaaaaaaa", "abababababab", "abcabcabcabc", "123456789012", "qwertyuiopas", "zyxwvutsrqpo", "asdfghjklasd"]) {
    assert.equal(ok(pw), false, pw);
  }
});

t("a password containing the account's own email or name is rejected", () => {
  assert.equal(ok("avraham-Blue-River-77"), false);
  assert.equal(ok("Avrah4m-purple-tree"), false);
  assert.equal(ok("my-lalum-secret-door"), false);
  assert.equal(ok("Orchard-Violin-Sparrow-Quilt", { email: "x@y.com", name: "Dana Cohen" }), true);
  assert.equal(ok("dana-Orchard-Violin-Sparrow", { email: "x@y.com", name: "Dana Cohen" }), false);
});

t("long unrelated-word phrases and random passwords pass", () => {
  for (const pw of ["correct horse battery staple", "Orchard-Violin-Sparrow-Quilt", "t9Xq-4Lw8-Zp2m-Vr7k", "mango telescope river clock"]) {
    assert.equal(ok(pw), true, pw);
  }
});

t("a password longer than 72 bytes is rejected, because bcrypt would ignore the rest", () => {
  const long = "Orchard-Violin-Sparrow-Quilt-".repeat(3);
  assert.equal(long.length > 72, true);
  assert.equal(evaluatePassword(long, ctx).rules.withinMax, false);
  assert.equal(ok(long), false);
  // multi-byte characters count as bytes, not characters
  assert.equal(evaluatePassword("שלום".repeat(8), ctx).rules.withinMax, true);
  assert.equal(evaluatePassword("שלום".repeat(8) + "אבגדהוזחטי", ctx).rules.withinMax, false);
});

t("the score rises with length and variety, and known-bad never exceeds weak", () => {
  const s = (pw) => evaluatePassword(pw, ctx).score;
  assert.equal(s(""), 0);
  assert.ok(s("Tq9!xv") <= 1);
  assert.ok(s("Orchard-Violin-Sparrow-Quilt") >= 3);
  assert.ok(s("password1234567890abcdef") <= 1);
  assert.ok(s("t9Xq-4Lw8-Zp2m-Vr7k") >= s("t9Xq4Lw8"));
});

t("a generated password is scored strong", () => {
  const pw = "t9Xq-4Lw8-Zp2m-Vr7k";
  assert.equal(evaluatePassword(pw, ctx, { generated: true }).score, 4);
  assert.equal(evaluatePassword("password1234", ctx, { generated: true }).score <= 1, true);
});

t("Hebrew phrases are accepted as passphrases", () => {
  assert.equal(ok("תפוז-גשר-כוכב-שולחן-עצים"), true);
});
