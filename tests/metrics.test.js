import { describe, it, expect } from "vitest";
import { emptyState } from "../src/data/store.js";
import * as M from "../src/lib/metrics.js";

function state() {
  const s = emptyState();
  const L = (id, o) => s.leads.push({ id, source: "website", qualified: null, program_interest: "kids", inquiry_date: "2026-09-05", stage: "new", ...o });
  L("a", { stage: "enrolled", enrolled_on: "2026-09-20", source: "facebook", qualified: true, membership_id: "m1" });
  L("b", { stage: "lost", lost_reason: "distance", source: "facebook", qualified: false });
  L("c", { stage: "lost", lost_reason: "finances" });
  L("d", { stage: "contacted" });
  L("e", { stage: "enrolled", enrolled_on: "2026-09-08", source: "family" }); // signed on the spot, no trial
  s.trials.push({ id: "t1", lead_id: "a", status: "attended", scheduled_at: "2026-09-12T17:10", offer: "free_week" });
  s.trials.push({ id: "t2", lead_id: "c", status: "attended", scheduled_at: "2026-09-14T17:10", offer: "free_week" });
  s.trials.push({ id: "t3", lead_id: "d", status: "no_show", scheduled_at: "2026-09-15T17:10", offer: "free_week" });
  s.memberships.push({ id: "m1", membership: "3 Month Yellow Belt", payment_type: "PIF" });
  s.marketing_spend.push({ month: "2026-09", source: "facebook", amount: 400 });
  return s;
}
const SEPT = { from: "2026-09-01", to: "2026-09-30" };

describe("analytics definitions", () => {
  it("counts the funnel the way the spreadsheet does", () => {
    const f = M.funnel(state(), SEPT);
    expect(f).toMatchObject({ inquiries: 5, qualified: 4, prospects: 3, signs: 2 });
    expect(f.prospectToSign).toBeCloseTo(2 / 3);
  });
  it("builds the monthly row with active prospects and signings by date", () => {
    const [r] = M.monthlyTable(state(), ["2026-09"]);
    expect(r).toMatchObject({ inquiries: 5, activeProspects: 2, signings: 2 });
    expect(["website", "facebook"]).toContain(r.topSource); // 2 each
  });
  it("computes cost per signing by source", () => {
    const fb = M.bySource(state(), SEPT).find((r) => r.source === "facebook");
    expect(fb).toMatchObject({ inquiries: 2, qualified: 1, signs: 1, spend: 400, costPerSign: 400, costPerLead: 400 });
  });
  it("reports show rate, lost reasons and enrollment mix", () => {
    const s = state();
    expect(M.trialStats(s, SEPT)).toMatchObject({ attended: 2, noShows: 1 });
    expect(M.lostReasons(s, SEPT).map((r) => r.reason).sort()).toEqual(["distance", "finances"]);
    expect(M.enrollmentMix(s, SEPT)).toMatchObject({ total: 2 });
  });
  it("lists months across a year boundary", () => {
    expect(M.monthsBetween("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
