// Pure helpers for the business profile (no Supabase import, so Node scripts can run them).

export type EntityType = "INDIVIDUAL" | "COMPANY";
export interface BusinessProfile { firmId: string; entityType: EntityType; taxId: string; legalName: string; softwareRegNumber: string | null }
export interface BusinessAddress { kind: "FINANCE" | "PUBLIC"; validFrom: string; street: string; houseNum: string; city: string; zip: string }

/** Israeli identity / company number: nine digits, check digit by the usual 1,2 weighting. Mirrors lalum_il_id_ok. */
export function ilIdOk(p: string): boolean {
  if (!/^\d{9}$/.test(p)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const d = Number(p[i]) * (i % 2 === 0 ? 1 : 2);
    sum += d > 9 ? d - 9 : d;
  }
  return sum % 10 === 0;
}

/** The address of a kind in force on an ISO date: the latest one that started on or before it. */
export function addressOn(list: BusinessAddress[], kind: BusinessAddress["kind"], isoDate: string): BusinessAddress | null {
  let cur: BusinessAddress | null = null;
  for (const a of list) if (a.kind === kind && a.validFrom <= isoDate && (!cur || a.validFrom > cur.validFrom)) cur = a;
  return cur;
}
