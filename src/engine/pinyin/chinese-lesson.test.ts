import { describe, expect, it } from "vitest";
import { DEFAULT_ADAPTIVE_SETTINGS, Target } from "../adaptive";
import { buildSyllableStatsMap, planChineseLesson } from "./chinese-lesson";

describe("planChineseLesson", () => {
  it("starts with the minimum syllable set and focuses an unknown syllable", () => {
    const plan = planChineseLesson(
      ["shi", "de", "yi", "bu"],
      new Map(),
      new Target(50),
      DEFAULT_ADAPTIVE_SETTINGS,
    );

    expect(plan.included).toEqual(["shi", "de", "yi", "bu"]);
    expect(plan.focus).toBe("shi");
    expect(plan.syllables.map((s) => [s.pinyin, s.included, s.focused])).toEqual([
      ["shi", true, true],
      ["de", true, false],
      ["yi", true, false],
      ["bu", true, false],
    ]);
  });

  it("unlocks exactly one syllable when every included syllable has best-ever mastery", () => {
    const stats = buildSyllableStatsMap([
      { shi: 100, de: 110 },
      { shi: 90, de: 100 },
    ]);
    const plan = planChineseLesson(["shi", "de", "yi", "bu"], stats, new Target(50), {
      minAlphabetSize: 2,
      alphabetExpansion: 0,
    });

    expect(plan.included).toEqual(["shi", "de", "yi"]);
    expect(plan.focus).toBe("yi");
    expect(plan.syllables.find((s) => s.pinyin === "yi")?.bestConfidence).toBeNull();
  });

  it("uses best-ever confidence for unlocks and current confidence for focus", () => {
    const stats = buildSyllableStatsMap([
      { shi: 100, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
      { shi: 2_000, de: 100, yi: 100 },
    ]);
    const plan = planChineseLesson(["shi", "de", "yi", "bu"], stats, new Target(50), {
      minAlphabetSize: 3,
      alphabetExpansion: 0,
    });

    expect(plan.included).toEqual(["shi", "de", "yi", "bu"]);
    expect(plan.focus).toBe("bu");
    expect(plan.syllables.find((s) => s.pinyin === "shi")?.bestConfidence).toBeGreaterThanOrEqual(
      1,
    );
    expect(plan.syllables.find((s) => s.pinyin === "shi")?.confidence).toBeLessThan(1);
  });
});
