// The issuing business, per firm: who it is and where it sits. Read from lalum_fin_business_profile and
// lalum_fin_business_addresses (migration 0038). The code keeps its built-in constants as the fallback for a firm
// that has no row yet, so nothing breaks before the profile is filled in.
import { supabase } from "../supabase";
import type { BusinessAddress, BusinessProfile, EntityType } from "./businessProfileCore";

export { ilIdOk, addressOn } from "./businessProfileCore";
export type { BusinessAddress, BusinessProfile, EntityType } from "./businessProfileCore";



export async function loadBusiness(firmId: string): Promise<{ profile: BusinessProfile | null; addresses: BusinessAddress[] }> {
  if (!supabase) return { profile: null, addresses: [] };
  const [p, a] = await Promise.all([
    supabase.from("lalum_fin_business_profile").select("firm_id, entity_type, tax_id, legal_name, software_reg_number").eq("firm_id", firmId).maybeSingle(),
    supabase.from("lalum_fin_business_addresses").select("kind, valid_from, street, house_num, city, zip").eq("firm_id", firmId),
  ]);
  const r = p.data as { firm_id: string; entity_type: EntityType; tax_id: string; legal_name: string; software_reg_number: string | null } | null;
  const addresses = ((a.data as Array<{ kind: BusinessAddress["kind"]; valid_from: string; street: string; house_num: string; city: string; zip: string }> | null) ?? [])
    .map((x) => ({ kind: x.kind, validFrom: x.valid_from, street: x.street, houseNum: x.house_num, city: x.city, zip: x.zip }));
  return { profile: r ? { firmId: r.firm_id, entityType: r.entity_type, taxId: r.tax_id, legalName: r.legal_name, softwareRegNumber: r.software_reg_number } : null, addresses };
}
