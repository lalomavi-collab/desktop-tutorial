// Staleness alarm for the statutory tax parameters. Exits 1 when the current year is missing or still a draft, or when
// it is November or later and the next year has no parameters yet. Run weekly by .github/workflows/tax-params-watch.yml.
// Note: it reads the built in table. Rows in `lalum_tax_params` are not visible to it; that table is for the live app.
import { TAX_PARAMS, paramsStaleness } from "../src/lib/cockpit/taxParams.ts";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const problems = paramsStaleness(today);
if (problems.length) { console.error(`[FAIL] פרמטרי מס, ${today}:\n- ${problems.join("\n- ")}`); process.exit(1); }
console.log(`[PASS] tax parameters current for ${today} (${Object.keys(TAX_PARAMS).join(", ")})`);
