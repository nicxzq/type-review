import { describe, expect, it } from "vitest";
import { buildSyllableInventory } from "./syllable-inventory";

describe("buildSyllableInventory", () => {
  it("orders syllables by descending corpus frequency, then alphabetically", () => {
    expect(
      buildSyllableInventory([
        ["zhong", "guo", "ren"],
        ["ren", "min", "guo"],
        ["ai", "ren"],
        ["min", "ai"],
      ]),
    ).toEqual(["ren", "ai", "guo", "min", "zhong"]);
  });

  it("accepts cell objects and normalizes casing", () => {
    expect(
      buildSyllableInventory([[{ pinyin: "Zhong" }, { pinyin: "guo" }], [{ pinyin: "zhong" }]]),
    ).toEqual(["zhong", "guo"]);
  });
});
