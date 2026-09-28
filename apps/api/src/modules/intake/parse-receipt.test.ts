import { describe, expect, it } from "vitest";
import { parseReceipt } from "./parse-receipt";

const SAMPLE = `
FRESH MART
123 Market Street
Tel (555) 010-0100
09/28/2026
Cashier: Ada

MILK 2%                 3.49
2 EGGS                  6.00
GREEN ONION             0.99
SPINACH                 2.50

SUBTOTAL               12.98
TAX                     1.04
TOTAL                  14.02
VISA CREDIT ****1234
THANK YOU FOR SHOPPING
`;

describe("parseReceipt", () => {
  it("drops totals, tax, and store headers and keeps item lines", () => {
    const lines = parseReceipt(SAMPLE);
    expect(lines.map((line) => line.name)).toEqual(["MILK 2%", "EGGS", "GREEN ONION", "SPINACH"]);
    expect(lines.find((line) => line.name === "EGGS")?.quantity).toBe(2);
    expect(lines.find((line) => line.name === "GREEN ONION")?.price).toBe(0.99);
    expect(lines.some((line) => /total|tax|visa|thank|mart/i.test(line.name))).toBe(false);
  });
});
