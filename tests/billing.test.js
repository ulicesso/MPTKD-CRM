// The billing math ported from the tuition dashboard. These use made-up members;
// the port was also checked by hand against the real roster (numbers in the brief).
import { describe, it, expect } from "vitest";
import { monthDays, summarize, pifStatus, projection, buildMembers, autoMap, parseCSV, normStatus } from "../src/lib/billing.js";

const m = (o) => ({ name: "X", program: "Kids 6–12", plan: "12 Month Program", type: "monthly", amount: 195, billDay: 15, start: "2026-01-01", end: "", status: "active", ...o });

describe("billing math", () => {
  it("bills on the last day when the billing day doesn't exist that month", () => {
    const days = monthDays([m({ billDay: 31 })], 2026, 1); // February 2026
    expect(days[27].amt).toBe(195);
  });
  it("skips drafts before the start date and after the end date", () => {
    expect(monthDays([m({ start: "2026-10-20" })], 2026, 9).reduce((a, d) => a + d.amt, 0)).toBe(0);
    expect(monthDays([m({ end: "2026-10-10" })], 2026, 9).reduce((a, d) => a + d.amt, 0)).toBe(0);
  });
  it("on-break students bill again from their resume date", () => {
    const x = m({ status: "onbreak", resume: "2026-11-08", billDay: 10 });
    expect(monthDays([x], 2026, 9)[9].amt).toBe(0);
    expect(monthDays([x], 2026, 10)[9].amt).toBe(195);
  });
  it("paused, awaiting renewal, paid ahead and not paying never bill", () => {
    for (const s of ["paused", "awaiting", "paidahead", "notpaying"]) {
      expect(monthDays([m({ status: s })], 2026, 9).reduce((a, d) => a + d.amt, 0)).toBe(0);
    }
  });
  it("buckets PIF renewals by days left", () => {
    const today = new Date(2026, 9, 1);
    expect(pifStatus({ end: "2026-09-30" }, today).key).toBe("expired");
    expect(pifStatus({ end: "2026-10-31" }, today).key).toBe("due");
    expect(pifStatus({ end: "2026-11-29" }, today).key).toBe("soon");
    expect(pifStatus({ end: "2026-12-20" }, today).key).toBe("upcoming");
    expect(pifStatus({ end: "2027-06-01" }, today).key).toBe("active");
  });
  it("summarizes monthly billing and keeps PIF out of it", () => {
    const S = summarize([m(), m({ amount: 210, billDay: 2 }), { name: "P", type: "pif", paid: 1942.5, end: "2027-05-01", status: "active" }], new Date(2026, 9, 1));
    expect(S.mrr).toBe(405);
    expect(S.total).toBe(405);
    expect(S.pifCount).toBe(1);
    expect(S.pifValue).toBe(1942.5);
    expect(projection([m()], new Date(2026, 9, 1), 6)).toHaveLength(6);
  });
  it("imports a CSV with the roster headings", () => {
    const rows = parseCSV("Student Name,Program,Membership,Payment Type,Monthly Amount,Billing Day,Payment Method,Start Date,Status\nDoe, Jane,Kids 6–12,12 Month Program,Monthly,175,14th,Card (no fee),10/14/2025,On Break\n".replace("Doe, Jane", '"Doe, Jane"'));
    const out = buildMembers(rows.slice(1), autoMap(rows[0]), false);
    expect(out[0]).toMatchObject({ name: "Doe, Jane", type: "monthly", amount: 175, billDay: 14, method: "Card (no fee)", start: "2025-10-14", status: "onbreak" });
    expect(normStatus("Not Paying")).toBe("notpaying");
  });
});
