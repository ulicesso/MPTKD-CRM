// Runs the real migration in Postgres (PGlite, in-process) and loads the demo data,
// so schema checks, foreign keys and row-level security are all exercised.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import { generateSeed } from "../src/data/seed.js";
import { toSQL } from "../src/data/sql.js";

const SUPABASE_STUB = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
`;
let db, seed;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(fs.readFileSync("supabase/migrations/0001_core_schema.sql", "utf8"));
  await db.exec("grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;");
  seed = generateSeed({ today: "2026-10-01" });
  await db.exec(toSQL(seed));
}, 60000);

async function as(staffName, sql) {
  const staff = seed.staff.find((s) => s.name === staffName);
  const authId = "00000000-0000-4000-8000-" + staff.id.slice(-12);
  await db.query("update staff set auth_user_id = $1 where id = $2", [authId, staff.id]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${authId}', false);`);
  try { return (await db.query(sql)).rows; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}

describe("database schema", () => {
  it("accepts all the demo data", async () => {
    for (const t of ["families", "students", "memberships", "leads", "trials", "activities"]) {
      const { rows } = await db.query(`select count(*)::int as n from ${t}`);
      expect(rows[0].n).toBe(seed[t].length);
    }
  });
  it("rejects an unknown stage", async () => {
    const l = seed.leads[0];
    await expect(db.query("update leads set stage = 'maybe' where id = $1", [l.id])).rejects.toThrow();
  });
  it("lets admins see billing", async () => {
    const rows = await as("Ulices Sotelo", "select count(*)::int as n from memberships");
    expect(rows[0].n).toBe(seed.memberships.length);
  });
  it("hides billing from instructors but not leads", async () => {
    expect((await as("Dana Kerrigan", "select count(*)::int as n from memberships"))[0].n).toBe(0);
    expect((await as("Dana Kerrigan", "select count(*)::int as n from marketing_spend"))[0].n).toBe(0);
    expect((await as("Dana Kerrigan", "select count(*)::int as n from leads"))[0].n).toBe(seed.leads.length);
  });
  it("shows nothing to someone who isn't on staff", async () => {
    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-999999999999', false);");
    const { rows } = await db.query("select count(*)::int as n from leads");
    await db.exec("reset role;");
    expect(rows[0].n).toBe(0);
  });
});
