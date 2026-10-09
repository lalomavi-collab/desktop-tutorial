// Checks the client mirror of lalum_kyc_missing against the cases verified on the database.
// Run with: npm run kyc-check
import assert from "node:assert/strict";
import { blankKyc, kycMissing, needsPartner, pendingBusiness } from "../src/lib/cockpit/kyc.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const rec = (o) => ({ ...blankKyc(1), ...o });

t("partial individual matches the database result", () => {
  assert.deepEqual(kycMissing(rec({ id_verified: true })), ["id_method", "source_of_funds", "pep", "sanctions_screened", "risk"]);
});
t("complete individual", () => {
  assert.deepEqual(kycMissing(rec({ id_verified: true, id_method: "IN_PERSON", source_of_funds: "SALARY", source_documented: true, pep: "NO", sanctions_screened: true, risk: "LOW" })), []);
});
t("company needs registry, signatory and beneficial owner", () => {
  const c = rec({ subject_kind: "COMPANY", id_verified: true, id_method: "REMOTE", source_of_funds: "NOT_APPLICABLE", pep: "NO", sanctions_screened: true, risk: "HIGH" });
  assert.deepEqual(kycMissing(c), ["registry_checked", "signatory_verified", "beneficial_owner_identified"]);
});
t("source documented is asked only when a source is stated", () => {
  assert.ok(kycMissing(rec({ source_of_funds: "LOAN" })).includes("source_documented"));
  assert.ok(!kycMissing(rec({ source_of_funds: "NOT_APPLICABLE" })).includes("source_documented"));
});
t("a failed check is not a pass", () => {
  assert.ok(kycMissing(rec({ id_verified: false, sanctions_screened: false })).includes("id_verified"));
  assert.ok(kycMissing(rec({ sanctions_screened: false })).includes("sanctions_screened"));
});
t("partner required for high risk or PEP; pending counts business track only", () => {
  assert.equal(needsPartner(rec({ risk: "HIGH" })), true);
  assert.equal(needsPartner(rec({ pep: "YES" })), true);
  assert.equal(needsPartner(rec({ risk: "LOW", pep: "NO" })), false);
  assert.equal(pendingBusiness([rec({ service_track: "BUSINESS_SERVICE" }), rec({ service_track: "BUSINESS_SERVICE", status: "COMPLETE" }), rec({})]), 1);
});
console.log("\nAll KYC checks passed");
