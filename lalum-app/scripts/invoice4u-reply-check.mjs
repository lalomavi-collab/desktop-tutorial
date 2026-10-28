// Checks how Invoice4U replies are read (supabase/functions/_shared/invoice4u.ts) and the guarantees lalum-fin-issue builds on them.
// Run with: npm run invoice4u-reply-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readReply, replyProblem } from "../../supabase/functions/_shared/invoice4u.ts";

const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };

await t("all three envelopes are read: d, <Operation>Result, and bare", () => {
  assert.equal(readReply("CreateCustomer", 200, '{"d":{"ID":7,"Errors":[]}}').d.ID, 7);
  assert.equal(readReply("CreateCustomer", 200, '{"CreateCustomerResult":{"ID":8,"Errors":[]}}').d.ID, 8);
  assert.equal(readReply("CreateCustomer", 200, '{"ID":9,"Errors":[]}').d.ID, 9);
});
await t("a refused key is named, never read as a business refusal or as no data", () => {
  const r = readReply("GetDocuments", 200, '{"d":{"Errors":[{"__type":"CommonError:#Invoice.Common","Error":"UnauthorizedUser","ID":80,"Paramters":null}]}}');
  assert.equal(replyProblem(r), "invoice4u_unauthorized");
  assert.equal(replyProblem(readReply("X", 200, '{"d":{"Errors":[{"Error":"Unauthorized user"}]}}')), "invoice4u_unauthorized");
});
await t("a reply with nothing in it is unreadable, whatever the envelope", () => {
  for (const body of ['{"d":null}', '{"CreateCustomerResult":null}', "null", "[]", '{"d":[]}']) {
    const r = readReply("CreateCustomer", 200, body);
    assert.equal(r.empty, true, body);
    assert.equal(replyProblem(r), "provider_unreadable", body);
    assert.deepEqual(r.errors, []);
  }
});
await t("a business error is left to the caller, and a normal answer has no problem", () => {
  assert.equal(replyProblem(readReply("CreateCustomer", 200, '{"d":{"ID":0,"Errors":[{"ID":12,"Error":"Customer name already exists"}]}}')), null);
  assert.equal(replyProblem(readReply("GetDocuments", 200, '{"d":{"Response":[],"Errors":[]}}')), null);
});
await t("the shape names the status and the keys, never the content", () => {
  const r = readReply("CreateCustomer", 500, '{"ExceptionDetail":{"x":1},"Message":"Object reference not set","Name":"משה כהן","Email":"a@b.co"}');
  assert.ok(r.shape.startsWith("http=500 keys=ExceptionDetail,Message,Name,Email"));
  assert.ok(r.shape.includes("msg=Object reference not set"));
  assert.ok(!r.shape.includes("משה") && !r.shape.includes("a@b.co"));
  assert.ok(readReply("CreateCustomer", 200, '{"d":null}').shape.includes("empty"));
});
await t("a body that is not JSON throws, so the caller treats the outcome as uncertain", () => {
  assert.throws(() => readReply("CreateDocumentWithIdentifierValidation", 502, "<html>Bad gateway</html>"), /HTTP 502 non-JSON/);
});

// ---- lalum-fin-issue, pinned at the source ----
const issueSrc = readFileSync(new URL("../../supabase/functions/lalum-fin-issue/index.ts", import.meta.url), "utf8");
const importSrc = readFileSync(new URL("../../supabase/functions/lalum-fin-import/index.ts", import.meta.url), "utf8");
await t("a document is marked issued only with a number: the no number branch comes before the only issuing write", () => {
  const guard = issueSrc.indexOf("if (!numbered(d)) {\n      await store({ last_error: redact(`UNCERTAIN NO_NUMBER");
  const write = issueSrc.lastIndexOf('status: "ISSUED"');
  assert.ok(guard > 0 && write > guard);
});
await t("a refused key during issuing stops before any business error handling and keeps the draft", () => {
  const unauth = issueSrc.indexOf('replyProblem(result) === "invoice4u_unauthorized"'), rejected = issueSrc.indexOf('code: "invoice4u_rejected"');
  assert.ok(unauth > 0 && rejected > unauth);
});
await t("CreateCustomer: only a named error suggests linking an existing customer", () => {
  const block = issueSrc.slice(issueSrc.indexOf('call("CreateCustomer"'), issueSrc.indexOf("clientId = id;"));
  assert.ok(block.includes('replyProblem(r) ?? (errors.length ? null : "provider_unreadable")'));
  assert.ok(block.indexOf("if (problem) return") < block.indexOf('hint: "link_existing_customer"'));
});
await t("reconcile never reports a refused key as a missing document", () => {
  const block = issueSrc.slice(issueSrc.indexOf('call("GetDocumentByApiIdentifier"'), issueSrc.indexOf('code: "not_found_at_provider"'));
  assert.ok(block.includes('"invoice4u_unauthorized"'));
});
await t("the key check is read only and needs the issuing level, but no fresh second factor", () => {
  const start = issueSrc.indexOf('if (action === "check") {'), end = issueSrc.indexOf('if (!docId) return json(400');
  const block = issueSrc.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.ok(block.includes('call("GetDocuments"') && block.includes("p_min: 3"));
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|store\(|Create/.test(block));
  assert.ok(issueSrc.indexOf('if (action === "issue") {\n    const age = secondFactorAge') > end, "the fresh factor gate stays on issue");
});
await t("the customer import does not log a refused key as a clean run of zero", () => {
  assert.ok(importSrc.includes("if (errors.length || problem) {"));
  assert.ok(!/parsed\.d \?\?/.test(importSrc) && !/parsed\.d \?\?/.test(issueSrc), "both read replies through readReply");
});
