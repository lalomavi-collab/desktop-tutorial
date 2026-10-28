// Reading Invoice4U replies, shared by lalum-fin-issue and lalum-fin-import. Pure, so scripts/invoice4u-reply-check.mjs runs it under node.

export type Obj = Record<string, unknown>;
export interface I4uError { ID?: number; Error?: string }
/** One Invoice4U reply. `empty` is a reply that carries no object at all (`{"d":null}`); `shape` describes it for last_error and the log
 *  without copying its content, which can hold customer details. */
export interface Reply { d: Obj; errors: I4uError[]; empty: boolean; shape: string }

export const UNAUTHORIZED_USER = 80;

/** Reads a reply. The envelope differs between endpoints: `d`, or `<Operation>Result`, or bare. Throws on a body that is not JSON. */
export function readReply(op: string, httpStatus: number, text: string): Reply {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(`${op} HTTP ${httpStatus} non-JSON`); }
  const top = (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as Obj;
  const inner = "d" in top ? top.d : `${op}Result` in top ? top[`${op}Result`] : parsed;
  const empty = !inner || typeof inner !== "object" || Array.isArray(inner);
  const d = (empty ? {} : inner) as Obj;
  const message = typeof top.Message === "string" ? ` msg=${top.Message.slice(0, 120)}` : "";
  return {
    d, empty, errors: Array.isArray(d.Errors) ? (d.Errors as I4uError[]) : [],
    shape: `http=${httpStatus} keys=${Object.keys(top).slice(0, 8).join(",") || "none"}${empty ? " empty" : ""}${message}`,
  };
}

/** What stops a reply from being read as an answer. Invoice4U refuses a token it does not accept with UnauthorizedUser (ID 80): GetDocuments
 *  said so from 21.10.2026 19:31 UTC. A reply with no object and no Errors is unreadable: on 23.10.2026 CreateCustomer answered that way with
 *  the same key, the old reading turned it into "the customer already exists", and GetCustomersByOrgId turned it into "no customers". */
export function replyProblem(r: Reply): "invoice4u_unauthorized" | "provider_unreadable" | null {
  if (r.errors.some((e) => e.ID === UNAUTHORIZED_USER || /unauthori[sz]ed/i.test(String(e.Error ?? "")))) return "invoice4u_unauthorized";
  return r.empty ? "provider_unreadable" : null;
}
