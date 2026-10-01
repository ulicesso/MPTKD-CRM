import { describe, it, expect } from "vitest";
import { generateSeed } from "../src/data/seed.js";
import { allLeadViews } from "../src/data/selectors.js";

const TODAY = "2026-10-01";
const s = generateSeed({ today: TODAY });

describe("demo data", () => {
  it("is deterministic for a given day", () => {
    const t = generateSeed({ today: TODAY });
    expect(t.leads.map((l) => [l.inquiry_date, l.stage])).toEqual(s.leads.map((l) => [l.inquiry_date, l.stage]));
  });
  it("has every reference pointing at a real row", () => {
    const ids = (t) => new Set(s[t].map((r) => r.id));
    const fam = ids("families"), stu = ids("students"), lead = ids("leads"), ms = ids("memberships"), staff = ids("staff");
    for (const g of s.guardians) expect(fam.has(g.family_id)).toBe(true);
    for (const x of s.students) expect(fam.has(x.family_id)).toBe(true);
    for (const m of s.memberships) expect(stu.has(m.student_id)).toBe(true);
    for (const l of s.leads) {
      expect(fam.has(l.family_id) && stu.has(l.student_id)).toBe(true);
      if (l.membership_id) expect(ms.has(l.membership_id)).toBe(true);
      if (l.owner_id) expect(staff.has(l.owner_id)).toBe(true);
      if (l.stage === "enrolled") expect(l.membership_id).toBeTruthy();
      if (l.stage === "lost") expect(l.lost_reason).toBeTruthy();
    }
    for (const t of s.trials) expect(lead.has(t.lead_id)).toBe(true);
    for (const a of s.activities) expect(lead.has(a.lead_id)).toBe(true);
  });
  it("covers the situations the team needs to test", () => {
    const v = allLeadViews(s, TODAY);
    const count = (f) => v.filter(f).length;
    expect(count((x) => x.nextTrial?.scheduled_at.startsWith(TODAY))).toBeGreaterThanOrEqual(2);
    expect(count((x) => x.nextTrial && x.nextTrial.scheduled_at.slice(0, 10) > TODAY)).toBeGreaterThanOrEqual(4);
    expect(count((x) => x.followUp.key === "overdue")).toBeGreaterThanOrEqual(4);
    expect(count((x) => x.lead.stage === "new")).toBeGreaterThanOrEqual(3);
    expect(count((x) => x.lead.stage === "decision")).toBeGreaterThanOrEqual(2);
    expect(count((x) => x.lead.stage === "nurture")).toBeGreaterThanOrEqual(1);
    expect(count((x) => x.lead.stage === "enrolled")).toBeGreaterThanOrEqual(20);
    expect(count((x) => x.needsDecision)).toBeGreaterThanOrEqual(1);
    expect(new Set(s.leads.map((l) => l.source)).size).toBeGreaterThanOrEqual(8);
    const multi = s.families.filter((f) => s.students.filter((x) => x.family_id === f.id).length > 1);
    expect(multi.length).toBeGreaterThanOrEqual(10);
  });
  it("never logs activity in the future", () => {
    expect(s.activities.every((a) => a.at.slice(0, 10) <= TODAY)).toBe(true);
  });
  it("uses only fictional contact details", () => {
    expect(s.guardians.every((g) => !g.email || g.email.endsWith("@example.com"))).toBe(true);
    expect(s.guardians.every((g) => !g.phone || /-555-01\d\d$/.test(g.phone))).toBe(true);
  });
});
