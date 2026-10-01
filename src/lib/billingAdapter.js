/*
 * Bridges CRM records (students + memberships tables) and the billing math
 * in ./billing.js, and prices new enrollments using the rules in the brief.
 */
import { normStatus } from "./billing.js";
import { MEMBERSHIP, PROGRAM, CARD_FEE } from "./constants.js";

/** Build the billing dashboard's "member" shape from a CRM membership row. */
export function memberFromMembership(ms, student, family) {
  const type = ms.payment_type === "PIF" ? "pif" : "monthly";
  const amount = type === "monthly" ? Number(ms.monthly_amount) || 0 : 0;
  return {
    id: ms.id,
    studentId: student?.id,
    name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
    family: family?.name || "",
    program: PROGRAM[ms.program]?.label || "Unassigned",
    plan: ms.membership || (type === "pif" ? "Paid in full" : "Monthly"),
    type,
    amount,
    rate: amount,
    discount: Number(ms.family_discount) || 0,
    pifDiscount: type === "pif" ? Number(ms.pif_discount) || 0 : 0,
    method: type === "monthly" ? ms.payment_method || "" : "",
    billDay: type === "monthly" ? Number(ms.billing_day) || 0 : 0,
    start: ms.start_date || "",
    end: ms.end_date || "",
    paid: type === "pif" ? Number(ms.pif_amount) || 0 : 0,
    paidDate: ms.paid_date || "",
    status: normStatus(ms.status),
    resume: ms.billing_resumes || "",
  };
}

/** Base monthly rate for a membership and program, or null if not offered. */
export function baseRate(membershipKey, programKey) {
  const m = MEMBERSHIP[membershipKey];
  if (!m || m.pifOnly) return null;
  return programKey === "little_tigers" ? m.ltRate ?? m.rate : m.rate ?? m.ltRate;
}

/**
 * Price a new enrollment.
 * Rules (brief, section 3): family discount comes off first, then the PIF
 * percentage; card payers pay 3% on top of the monthly draft unless they
 * are on "Card (no fee)". Family discount is a monthly dollar amount here;
 * for PIF it becomes the term total.
 */
export function quote({ membership, program, paymentType, familyDiscount = 0, method = "ACH" }) {
  const m = MEMBERSHIP[membership];
  if (!m) return null;
  if (m.pifOnly) {
    return { monthly: 0, pifAmount: m.pifOnly, pifDiscount: 0, familyDiscountTotal: 0, months: m.months, note: "Holiday package, paid in full" };
  }
  const rate = baseRate(membership, program);
  if (rate == null) return null;
  const afterFamily = Math.max(0, rate - familyDiscount);
  if (paymentType === "PIF") {
    const months = m.months || 12;
    const gross = afterFamily * months;
    const pifDiscount = round2(gross * m.pifPct);
    return { monthly: 0, pifAmount: round2(gross - pifDiscount), pifDiscount, familyDiscountTotal: familyDiscount * months, months, rate };
  }
  const monthly = method === "Card" ? round2(afterFamily * (1 + CARD_FEE)) : afterFamily;
  return { monthly, pifAmount: 0, pifDiscount: 0, familyDiscountTotal: familyDiscount, months: m.months, rate };
}

/** Suggested family discount for the next student in a family with `activeCount` enrolled students. */
export function nextFamilyDiscount(activeCount, rate) {
  if (activeCount <= 0) return 0;
  if (activeCount === 1) return 20;
  if (activeCount === 2) return 40;
  return rate || 0; // 3rd add-on and beyond train free
}

function round2(n) { return Math.round(n * 100) / 100; }
