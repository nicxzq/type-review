import { describe, expect, it } from "vitest";
import type { InputSegment } from "../corpus";
import type { Step } from "../typing/types";
import {
  type ConfusionKind,
  classifyConfusion,
  confusableVariants,
  tallyConfusions,
} from "./confusion";

describe("confusableVariants", () => {
  it("swaps the -n / -ng nasal ending both ways", () => {
    expect(confusableVariants("min")).toContainEqual({ pinyin: "ming", kind: "nasal" });
    expect(confusableVariants("ming")).toContainEqual({ pinyin: "min", kind: "nasal" });
    expect(confusableVariants("xiang")).toContainEqual({ pinyin: "xian", kind: "nasal" });
    expect(confusableVariants("chuan")).toContainEqual({ pinyin: "chuang", kind: "nasal" });
  });

  it("swaps dental / retroflex initials both ways", () => {
    expect(confusableVariants("zi")).toContainEqual({ pinyin: "zhi", kind: "retroflex" });
    expect(confusableVariants("zhi")).toContainEqual({ pinyin: "zi", kind: "retroflex" });
    expect(confusableVariants("san")).toContainEqual({ pinyin: "shan", kind: "retroflex" });
  });

  it("swaps n / l initials both ways", () => {
    expect(confusableVariants("nan")).toContainEqual({ pinyin: "lan", kind: "nl" });
    expect(confusableVariants("lao")).toContainEqual({ pinyin: "nao", kind: "nl" });
  });

  it("yields two variants when both an initial and a nasal contrast apply", () => {
    // 娘 niang → 边鼻音 liang and 前后鼻音 nian
    const v = confusableVariants("niang");
    expect(v).toContainEqual({ pinyin: "liang", kind: "nl" });
    expect(v).toContainEqual({ pinyin: "nian", kind: "nasal" });
  });

  it("yields nothing for a syllable with no confusable contrast", () => {
    expect(confusableVariants("gu")).toEqual([]);
    expect(confusableVariants("hao")).toEqual([]);
  });

  it("does not treat ong as a nasal contrast", () => {
    expect(confusableVariants("gong")).toEqual([]);
  });

  it("only emits variants that are real pinyin syllables (no unattested forms)", () => {
    // mian/juan/xuan/tuan have no valid -ng nasal counterpart (miang/juang/…
    // are not syllables), so no nasal variant may be produced.
    expect(confusableVariants("mian")).toEqual([]);
    expect(confusableVariants("juan")).toEqual([]);
    expect(confusableVariants("xuan")).toEqual([]);
    expect(confusableVariants("tuan")).toEqual([]);
    // song has no retroflex counterpart (shong is not a syllable).
    expect(confusableVariants("song")).toEqual([]);
    // lia -> nia is not a syllable, and lia has no other contrast.
    expect(confusableVariants("lia")).toEqual([]);
    // nen keeps its valid nasal contrast (嫩/能) but drops n/l (len is unattested).
    expect(confusableVariants("nen")).toEqual([{ pinyin: "neng", kind: "nasal" }]);
  });
});

describe("classifyConfusion never mislabels a plain typo as a confusion", () => {
  it("does not fire when the keys match only an unattested variant", () => {
    // 自然码: mian = m + ian(m) = "mm". "md" would be miang (not a syllable) —
    // typing 'd' for the second key is a plain slip, not a 前后鼻音 confusion.
    expect(classifyConfusion("mian", "md", "ziranma")).toBeNull();
    // 自然码: juan = j + uan(r) = "jr"; "jd" (juang) is not a real contrast.
    expect(classifyConfusion("juan", "jd", "ziranma")).toBeNull();
  });
});

describe("classifyConfusion", () => {
  it("detects n/l in full pinyin (equal length)", () => {
    expect(classifyConfusion("nan", "lan", "full")).toBe("nl");
    expect(classifyConfusion("lao", "nao", "full")).toBe("nl");
  });

  it("does not fire when the user typed the correct keys", () => {
    expect(classifyConfusion("nan", "nan", "full")).toBeNull();
    expect(classifyConfusion("min", "mn", "ziranma")).toBeNull(); // mn = correct 自然码 for min
  });

  it("returns null for a random typo that matches no contrast", () => {
    expect(classifyConfusion("nan", "xxx", "full")).toBeNull();
    expect(classifyConfusion("hao", "hb", "xiaohe")).toBeNull();
  });

  it("detects all three families in double pinyin, where every syllable is two keys", () => {
    // 自然码: min=mn, ming=my → 前后鼻音 is a single-key swap.
    expect(classifyConfusion("min", "my", "ziranma")).toBe("nasal");
    // 自然码: zi=zi, zhi=vi → 平翘舌.
    expect(classifyConfusion("zi", "vi", "ziranma")).toBe("retroflex");
    // 小鹤: zhi=vi, zi=zi → 平翘舌.
    expect(classifyConfusion("zhi", "zi", "xiaohe")).toBe("retroflex");
    // 边鼻音 across schemes.
    expect(classifyConfusion("nan", "lj", "ziranma")).toBe("nl"); // lan = l+an(j) = "lj"
  });
});

describe("tallyConfusions", () => {
  // Build a step log where the character occupying [start,end) is typed as
  // `actual` (one step per position, last-wins).
  function stepsFor(pairs: ReadonlyArray<[number, string]>): Step[] {
    return pairs.map(([position, typed]) => ({
      position,
      timeStamp: position,
      typed,
      expected: typed,
      timeToType: 0,
      typo: false,
    }));
  }

  it("counts confusions per family and records the confused syllables", () => {
    // Two 自然码 cells: 民 min→mn typed as "my" (nasal), 四 si→si typed as "ui" (retroflex, shi).
    const segments: InputSegment[] = [
      { start: 0, end: 2, display: "民", hint: "mn", note: "min" },
      { start: 2, end: 4, display: "四", hint: "si", note: "si" },
    ];
    const steps = stepsFor([
      [0, "m"],
      [1, "y"],
      [2, "u"],
      [3, "i"],
    ]);
    const tally = tallyConfusions(segments, steps, 4, "ziranma");
    expect(tally.counts).toEqual({ nasal: 1, retroflex: 1, nl: 0 });
    expect(tally.hits).toContainEqual({ expected: "min", kind: "nasal" as ConfusionKind });
    expect(tally.hits).toContainEqual({ expected: "si", kind: "retroflex" as ConfusionKind });
  });

  it("ignores characters that were typed correctly", () => {
    const segments: InputSegment[] = [{ start: 0, end: 2, display: "民", hint: "mn", note: "min" }];
    const steps = stepsFor([
      [0, "m"],
      [1, "n"],
    ]);
    expect(tallyConfusions(segments, steps, 2, "ziranma").counts).toEqual({
      nasal: 0,
      retroflex: 0,
      nl: 0,
    });
  });

  it("skips characters that were never fully typed", () => {
    const segments: InputSegment[] = [{ start: 0, end: 2, display: "民", hint: "mn", note: "min" }];
    const steps = stepsFor([[0, "m"]]); // position 1 never typed
    expect(tallyConfusions(segments, steps, 2, "ziranma").hits).toEqual([]);
  });
});
