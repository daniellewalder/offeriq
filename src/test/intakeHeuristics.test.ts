import { describe, it, expect } from "vitest";
import { inferCategory, inferBuyerKey } from "@/lib/intakeHeuristics";

describe("inferCategory — real-world messy filenames", () => {
  const cases: Array<[string, string]> = [
    // Purchase agreements
    ["FINAL signed RPA - 1234 Oak St.pdf", "Purchase Agreement"],
    ["Smith Residential Purchase Agreement v3.pdf", "Purchase Agreement"],
    ["Johnson_offer_2.pdf", "Purchase Agreement"],
    ["Garcia purchase contract scan.pdf", "Purchase Agreement"],

    // Counters
    ["FINAL signed RPA - 1234 Oak St - countered v3.pdf", "Seller Counter"],
    ["Smith offer 2 REVISED countered back.pdf", "Buyer Counter"],
    ["Sellers Counter Offer #1.pdf", "Seller Counter"],
    ["Buyer counter - Lee.pdf", "Buyer Counter"],
    ["CO #2 fully executed.pdf", "Seller Counter"],

    // Proof of funds
    ["POF Wells Fargo.pdf", "Proof of Funds"],
    ["Chen - bank statement Sept.pdf", "Proof of Funds"],
    ["proof of funds - schwab brokerage.pdf", "Proof of Funds"],

    // Pre-approval / loan
    ["DU Approval - Patel.pdf", "Pre-Approval"],
    ["loan approval letter Bank of America.pdf", "Pre-Approval"],
    ["1003 - Martinez.pdf", "Pre-Approval"],
    ["Pre-Approval Letter v2.pdf", "Pre-Approval"],

    // Income
    ["W-2 2023 Smith.pdf", "Proof of Income"],
    ["Garcia paystubs Aug.pdf", "Proof of Income"],
    ["1040 tax return 2023.pdf", "Proof of Income"],

    // Disclosures / addenda
    ["TDS Smith.pdf", "Disclosures"],
    ["Addendum 3 - inspection.pdf", "Addenda"],

    // Junk
    ["random scan.pdf", "Other"],
  ];

  for (const [filename, expected] of cases) {
    it(`classifies "${filename}" as ${expected}`, () => {
      expect(inferCategory(filename)).toBe(expected);
    });
  }
});

describe("inferBuyerKey — strips noise, keeps buyer name", () => {
  it("extracts surname from a messy RPA filename", () => {
    expect(inferBuyerKey("FINAL signed RPA - 1234 Oak St - Smith v3.pdf")).toContain("smith");
  });
  it("extracts surname from a counter filename", () => {
    expect(inferBuyerKey("Patel offer countered back v2.pdf")).toContain("patel");
  });
  it("does not return a doc-type token as the buyer key", () => {
    const key = inferBuyerKey("POF Wells Fargo.pdf");
    expect(key).not.toBe("pof");
  });
  it("falls back to filename stem when nothing meaningful remains", () => {
    const key = inferBuyerKey("counter offer signed final v3.pdf");
    expect(key.length).toBeGreaterThan(0);
  });
});
