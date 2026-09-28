import { describe, expect, it } from "vitest";
import { readLocations } from "./query";

describe("readLocations", () => {
  it("defaults to refrigerator, freezer, and pantry", () => {
    expect(readLocations({})).toEqual(["refrigerator", "freezer", "pantry"]);
    expect(readLocations(undefined)).toEqual(["refrigerator", "freezer", "pantry"]);
    expect(readLocations({ locations: "all" })).toEqual(["refrigerator", "freezer", "pantry"]);
  });
});
