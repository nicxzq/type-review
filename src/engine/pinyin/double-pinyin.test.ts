import { describe, expect, it } from "vitest";
import { splitInitialFinal, toXiaohe } from "./double-pinyin";

/**
 * Golden table: full pinyin → 小鹤 two-key code. Property tests can't catch a
 * wrong lookup (a bad table still "produces two keys"), so correctness is
 * pinned by authoritative pairs covering every tricky class the reviewers
 * flagged.
 */
const GOLDEN: ReadonlyArray<[string, string]> = [
  // whole-reading syllables (韵母 is not a plain i)
  ["zhi", "vi"],
  ["chi", "ii"],
  ["shi", "ui"],
  ["ri", "ri"],
  ["zi", "zi"],
  ["ci", "ci"],
  ["si", "si"],
  // y/w glides — phonetic final carries the medial
  ["yi", "yi"],
  ["wu", "wu"],
  ["yu", "yv"],
  ["you", "yq"],
  ["yan", "ym"],
  ["yin", "yb"],
  ["yang", "yl"],
  ["ying", "yk"],
  ["yong", "ys"],
  ["yue", "yt"],
  ["yuan", "yr"],
  ["yun", "yy"],
  ["ye", "yp"],
  ["ya", "yx"],
  ["yao", "yn"],
  ["wo", "wo"],
  ["wa", "wx"],
  ["wai", "wk"],
  ["wei", "wv"],
  ["wan", "wr"],
  ["wen", "wy"],
  ["wang", "wl"],
  // ü after j/q/x (written u) and after n/l (written v)
  ["ju", "jv"],
  ["qu", "qv"],
  ["xue", "xt"],
  ["jue", "jt"],
  ["jun", "jy"],
  ["juan", "jr"],
  ["nv", "nv"],
  ["lv", "lv"],
  ["lve", "lt"],
  ["nu", "nu"],
  ["lu", "lu"],
  // contracted finals iu / ui / un
  ["liu", "lq"],
  ["gui", "gv"],
  ["lun", "ly"],
  // zero-initial syllables
  ["a", "aa"],
  ["o", "oo"],
  ["e", "ee"],
  ["er", "er"],
  ["ai", "ad"],
  ["ei", "ew"],
  ["ao", "ac"],
  ["ou", "oz"],
  ["an", "aj"],
  ["en", "ef"],
  ["ang", "ah"],
  ["eng", "eg"],
  // front/back nasal + zh/ch/sh initials
  ["min", "mb"],
  ["ming", "mk"],
  ["zhen", "vf"],
  ["zheng", "vg"],
  ["zhong", "vs"],
  ["guo", "go"],
  // every distinct syllable used in the bundled zh.json corpus
  ["chuang", "il"],
  ["qian", "qm"],
  ["shuang", "ul"],
  ["shang", "uh"],
  ["xiang", "xl"],
  ["jue", "jt"],
  ["qiong", "qs"],
  ["zhuo", "vo"],
  ["sheng", "ug"],
  ["huang", "hl"],
  ["geng", "gg"],
];

describe("toXiaohe (小鹤双拼)", () => {
  it.each(GOLDEN)("%s → %s", (full, expected) => {
    expect(toXiaohe(full)).toBe(expected);
  });

  it("always produces exactly two keys for a valid syllable", () => {
    for (const [full] of GOLDEN) {
      expect(toXiaohe(full)).toHaveLength(2);
    }
  });

  it("throws on an unrecognised syllable rather than guessing", () => {
    expect(() => toXiaohe("")).toThrow();
    expect(() => toXiaohe("xyz")).toThrow();
  });
});

describe("splitInitialFinal", () => {
  it("recognises two-letter initials zh/ch/sh", () => {
    expect(splitInitialFinal("zhong")).toEqual({ initial: "zh", final: "ong" });
    expect(splitInitialFinal("chuang")).toEqual({ initial: "ch", final: "uang" });
  });

  it("recognises single-letter initials", () => {
    expect(splitInitialFinal("guo")).toEqual({ initial: "g", final: "uo" });
  });

  it("returns an empty initial for zero-initial syllables", () => {
    expect(splitInitialFinal("an")).toEqual({ initial: "", final: "an" });
  });
});
