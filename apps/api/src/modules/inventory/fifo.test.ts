import { describe, expect, it } from "vitest";
import { consumeFifo } from "./fifo";

describe("consumeFifo", () => {
  it("takes quantity from the soonest-expiring lot first", () => {
    const next = consumeFifo(
      [
        { id: "later", location: "refrigerator", quantity: 2, expiryDate: "2026-10-10" },
        { id: "soon", location: "freezer", quantity: 1, expiryDate: "2026-09-29" },
        { id: "open", location: "pantry", quantity: 4, expiryDate: null },
      ],
      2,
    );
    expect(next.find((lot) => lot.id === "soon")).toBeUndefined();
    expect(next.find((lot) => lot.id === "later")?.quantity).toBe(1);
    expect(next.find((lot) => lot.id === "open")?.quantity).toBe(4);
  });
});
