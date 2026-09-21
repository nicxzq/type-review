import { describe, expect, it } from "vitest";
import { toZiranma } from "./ziranma";

/**
 * Golden table: full pinyin → 自然码 two-key code, derived from the
 * authoritative Rime `double_pinyin` (自然码) layout — not from the
 * implementation. A property test can't catch a wrong lookup (a bad table
 * still "produces two keys"), so correctness is pinned by these pairs covering
 * every tricky class plus every syllable in the bundled zh.json corpus.
 */
const GOLDEN: ReadonlyArray<[string, string]> = [
  // whole-reading syllables (韵母 is a plain i in 自然码)
  ["zhi", "vi"],
  ["chi", "ii"],
  ["shi", "ui"],
  ["ri", "ri"],
  ["zi", "zi"],
  ["ci", "ci"],
  ["si", "si"],
  // y/w — literal first key + written final (no glide restoration)
  ["yi", "yi"],
  ["wu", "wu"],
  ["yu", "yv"],
  ["you", "yb"],
  ["yan", "yj"],
  ["yin", "yn"],
  ["yang", "yh"],
  ["ying", "yy"],
  ["yong", "ys"],
  ["yue", "yt"],
  ["yuan", "yr"],
  ["yun", "yp"],
  ["ye", "ye"],
  ["ya", "ya"],
  ["yao", "yk"],
  ["wo", "wo"],
  ["wa", "wa"],
  ["wai", "wl"],
  ["wei", "wz"],
  ["wan", "wj"],
  ["wen", "wf"],
  ["wang", "wh"],
  ["weng", "wg"],
  // ü after j/q/x (written u) and after n/l (written v)
  ["ju", "jv"],
  ["qu", "qv"],
  ["xu", "xv"],
  ["xue", "xt"],
  ["jue", "jt"],
  ["jun", "jp"],
  ["juan", "jr"],
  ["nv", "nv"],
  ["lv", "lv"],
  ["lve", "lt"],
  ["nu", "nu"],
  ["lu", "lu"],
  // contracted finals iu / ui / un
  ["liu", "lq"],
  ["gui", "gv"],
  ["lun", "lp"],
  // zero-initial syllables
  ["a", "aa"],
  ["o", "oo"],
  ["e", "ee"],
  ["er", "er"],
  ["ai", "al"],
  ["ei", "ez"],
  ["ao", "ak"],
  ["ou", "ob"],
  ["an", "aj"],
  ["en", "ef"],
  ["ang", "ah"],
  ["eng", "eg"],
  // front/back nasal + zh/ch/sh initials
  ["min", "mn"],
  ["ming", "my"],
  ["zhen", "vf"],
  ["zheng", "vg"],
  ["zhong", "vs"],
  ["guo", "go"],
  // every distinct syllable used in the bundled zh.json corpus
  ["bai", "bl"],
  ["bu", "bu"],
  ["ceng", "cg"],
  ["chu", "iu"],
  ["chuang", "id"],
  ["chun", "ip"],
  ["dai", "dl"],
  ["di", "di"],
  ["duo", "do"],
  ["feng", "fg"],
  ["geng", "gg"],
  ["gong", "gs"],
  ["gu", "gu"],
  ["guang", "gd"],
  ["hai", "hl"],
  ["hao", "hk"],
  ["he", "he"],
  ["hen", "hf"],
  ["hua", "hw"],
  ["huang", "hd"],
  ["jin", "jn"],
  ["jing", "jy"],
  ["lai", "ll"],
  ["lao", "lk"],
  ["li", "li"],
  ["lou", "lb"],
  ["luo", "lo"],
  ["men", "mf"],
  ["mian", "mm"],
  ["mu", "mu"],
  ["neng", "ng"],
  ["niao", "nc"],
  ["qi", "qi"],
  ["qian", "qm"],
  ["qiao", "qc"],
  ["qin", "qn"],
  ["qiong", "qs"],
  ["ru", "ru"],
  ["san", "sj"],
  ["se", "se"],
  ["shan", "uj"],
  ["shang", "uh"],
  ["shao", "uk"],
  ["she", "ue"],
  ["sheng", "ug"],
  ["shou", "ub"],
  ["shu", "uu"],
  ["shuang", "ud"],
  ["ti", "ti"],
  ["tian", "tm"],
  ["tou", "tb"],
  ["tu", "tu"],
  ["xiang", "xd"],
  ["xiao", "xc"],
  ["xing", "xy"],
  ["zhu", "vu"],
  ["zhuo", "vo"],
  ["zu", "zu"],
];

describe("toZiranma (自然码双拼)", () => {
  it.each(GOLDEN)("%s → %s", (full, expected) => {
    expect(toZiranma(full)).toBe(expected);
  });

  it("always produces exactly two keys for a valid syllable", () => {
    for (const [full] of GOLDEN) {
      expect(toZiranma(full)).toHaveLength(2);
    }
  });

  it("throws on an unrecognised syllable rather than guessing", () => {
    expect(() => toZiranma("")).toThrow();
    expect(() => toZiranma("xyz")).toThrow();
  });
});
