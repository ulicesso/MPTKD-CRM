import { describe, it, expect } from "vitest";
import { quote, nextFamilyDiscount } from "../src/lib/billingAdapter.js";

describe("pricing rules from the brief", () => {
  it("applies the family discount first, then the PIF percentage", () => {
    // 12 Month Program at $195, minus $20 family = $175 × 12 = $2,100, minus 7.5% = $1,942.50
    const q = quote({ membership: "12 Month Program", program: "kids", paymentType: "PIF", familyDiscount: 20 });
    expect(q.pifAmount).toBe(1942.5);
    expect(q.familyDiscountTotal).toBe(240);
  });
  it("adds 3% for Card but not for Card (no fee)", () => {
    expect(quote({ membership: "Month to Month", program: "kids", paymentType: "Monthly", method: "Card" }).monthly).toBe(216.3);
    expect(quote({ membership: "Month to Month", program: "kids", paymentType: "Monthly", method: "Card (no fee)" }).monthly).toBe(210);
  });
  it("uses Little Tigers rates", () => {
    expect(quote({ membership: "6 Month Program", program: "little_tigers", paymentType: "Monthly" }).monthly).toBe(175);
  });
  it("prices holiday packages as fixed paid-in-full amounts", () => {
    expect(quote({ membership: "Holiday 10+2", program: "kids", paymentType: "Monthly" }).pifAmount).toBe(1850);
  });
  it("follows the family discount ladder", () => {
    expect([0, 1, 2, 3].map((n) => nextFamilyDiscount(n, 195))).toEqual([0, 20, 40, 195]);
  });
});
