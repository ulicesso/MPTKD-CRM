// Writes supabase/seed.sql with demo data dated around today (or a date you pass).
// Usage: npm run seed:sql            -> demo data for today
//        npm run seed:sql 2026-10-01 -> demo data for that day
import fs from "fs";
import { generateSeed } from "../src/data/seed.js";
import { toSQL } from "../src/data/sql.js";
import { todayISO } from "../src/lib/dates.js";

const today = process.argv[2] || todayISO();
fs.writeFileSync("supabase/seed.sql", toSQL(generateSeed({ today })) + "\n");
console.log(`Wrote supabase/seed.sql (demo data for ${today})`);
