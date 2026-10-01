import { describe, it, expect } from "vitest";
import { Tx, emptyState } from "../src/data/store.js";
import * as A from "../src/data/actions.js";

function setup() {
  let clock = "2026-10-01T10:00:00";
  const tx = new Tx(emptyState(), { now: () => clock, today: () => clock.slice(0, 10) });
  const staff = tx.insert("staff", { name: "Tester", role: "admin", active: true });
  tx.ctx.staffId = staff.id;
  const { family, leads } = A.addInquiry(tx, {
    familyName: "Testwell", guardian: { first_name: "Pat", last_name: "Testwell", phone: "610-555-0100" },
    children: [{ first_name: "Ann", age: 8 }, { first_name: "Ben", age: 5 }], source: "website",
  });
  return { tx, family, leads, setClock: (c) => (clock = c) };
}

describe("sales workflow", () => {
  it("creates one family and one lead per child, due for contact the same day", () => {
    const { tx, leads } = setup();
    expect(tx.table("families")).toHaveLength(1);
    expect(leads).toHaveLength(2);
    expect(leads.map((l) => l.program_interest)).toEqual(["kids", "little_tigers"]);
    expect(leads[0]).toMatchObject({ stage: "new", next_follow_up: "2026-10-01" });
  });
  it("logging the first touch moves New to Contacted, for siblings too", () => {
    const { tx, leads } = setup();
    A.logContact(tx, leads.map((l) => l.id), { method: "call", outcome: "reached", body: "Hi", next_follow_up: "2026-10-03" });
    for (const l of leads) expect(tx.get("leads", l.id)).toMatchObject({ stage: "contacted", next_follow_up: "2026-10-03" });
    expect(tx.where("activities", (a) => a.kind === "contact")).toHaveLength(2);
  });
  it("books a trial, confirms the day before, and handles attended and no-show", () => {
    const { tx, leads } = setup();
    const [t] = A.scheduleTrial(tx, leads[0].id, { date: "2026-10-05", time: "5:10pm" });
    expect(t.scheduled_at).toBe("2026-10-05T17:10");
    expect(tx.get("leads", leads[0].id)).toMatchObject({ stage: "trial_scheduled", next_follow_up: "2026-10-04" });
    A.recordTrial(tx, t.id, "attended");
    expect(tx.get("leads", leads[0].id)).toMatchObject({ stage: "trial_completed", next_follow_up: "2026-10-06" });
    const [t2] = A.scheduleTrial(tx, leads[1].id, { date: "2026-10-06", time: "4:30pm" });
    A.recordTrial(tx, t2.id, "no_show");
    expect(tx.get("leads", leads[1].id).stage).toBe("contacted");
  });
  it("rebooking marks the old trial rescheduled", () => {
    const { tx, leads } = setup();
    const [a] = A.scheduleTrial(tx, leads[0].id, { date: "2026-10-05", time: "5:10pm" });
    A.scheduleTrial(tx, leads[0].id, { date: "2026-10-07", time: "5:10pm" });
    expect(tx.get("trials", a.id).status).toBe("rescheduled");
  });
  it("enrolling creates the membership and activates the student", () => {
    const { tx, leads } = setup();
    const ms = A.enroll(tx, leads[0].id, { membership: "12 Month Program", payment_type: "Monthly", monthly_amount: 195, payment_method: "ACH", start_date: "2026-10-01" });
    expect(ms).toMatchObject({ billing_day: 1, end_date: "2027-09-30", status: "Active", source_lead_id: leads[0].id });
    expect(tx.get("students", leads[0].student_id).status).toBe("active");
    expect(tx.get("leads", leads[0].id)).toMatchObject({ stage: "enrolled", membership_id: ms.id, next_follow_up: null });
  });
  it("requires a reason for Lost and a date for Nurture", () => {
    const { tx, leads } = setup();
    expect(() => A.markLost(tx, leads[0].id, "")).toThrow();
    expect(() => A.nurture(tx, leads[0].id, "")).toThrow();
    expect(() => A.moveStage(tx, leads[0].id, "enrolled")).toThrow();
    A.markLost(tx, leads[0].id, "schedule");
    expect(tx.get("leads", leads[0].id)).toMatchObject({ stage: "lost", lost_reason: "schedule" });
    A.reopen(tx, leads[0].id);
    expect(tx.get("leads", leads[0].id)).toMatchObject({ stage: "contacted", lost_reason: null });
  });
  it("records every stage change", () => {
    const { tx, leads } = setup();
    A.logContact(tx, leads[0].id, { method: "text", outcome: "replied" });
    A.moveStage(tx, leads[0].id, "decision");
    const ev = tx.where("lead_stage_events", (e) => e.lead_id === leads[0].id).map((e) => e.to_stage);
    expect(ev).toEqual(["new", "contacted", "decision"]);
  });
});
