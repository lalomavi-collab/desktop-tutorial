// The naming rule for migration files (docs/infra/migrations-map.md). Files numbered 0001 to 0081, and
// the two of PR 1228 that are already live, are history and keep their names. Every new file is named
// after the version recorded in production, YYYYMMDDHHMMSS_name.sql, and no two files share a version.
// A running number cannot hold while several sessions work at once: two of them both took 0082.
// Run: npm run migrations-check.
import { existsSync, readdirSync } from "node:fs";

const DIRS = ["../supabase/migrations", "../../supabase/migrations"].map((d) => new URL(d + "/", import.meta.url));
const HISTORY_MAX = 81;
const HISTORY_EXTRA = new Set(["0082_lalum_finance_tax_engine.sql", "0083_lalum_finance_fixed_asset_category.sql"]);
const errors = [];
const versions = new Map();
let count = 0;

const realTimestamp = (v) => {
  const d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12), +v.slice(12, 14)));
  return d.toISOString().replace(/\D/g, "").slice(0, 14) === v && +v.slice(0, 4) >= 2026;
};

for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  const rel = dir.pathname.replace(/^.*?((lalum-app\/)?supabase\/migrations\/)$/, "$1");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    count++;
    const legacy = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
    if (legacy && (+legacy[1] <= HISTORY_MAX || HISTORY_EXTRA.has(f))) continue;
    const stamped = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(f);
    if (!stamped) { errors.push(`${rel}${f}: name a new migration after the version recorded in production, YYYYMMDDHHMMSS_name.sql`); continue; }
    if (!realTimestamp(stamped[1])) { errors.push(`${rel}${f}: ${stamped[1]} is not a real UTC timestamp`); continue; }
    if (versions.has(stamped[1])) errors.push(`${rel}${f}: version ${stamped[1]} is already used by ${versions.get(stamped[1])}`);
    else versions.set(stamped[1], rel + f);
  }
}
if (errors.length) { console.error("migrations-check failed (see docs/infra/migrations-map.md):\n" + errors.map((e) => "  " + e).join("\n")); process.exit(1); }
console.log(`migrations-check: ${count} files ok, ${versions.size} named by version`);
