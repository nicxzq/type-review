/**
 * 小鹤双拼 (Xiaohe / Flypy) conversion: full pinyin → two keys.
 *
 * Correctness here is load-bearing — a wrong key silently marks the user's
 * correct input as a typo. Rather than "split and guess", the maps below encode
 * the authoritative Flypy layout, and every tricky class (zero-initial, y/w
 * glides, ü after j/q/x, whole-reading zhi/chi/shi, contracted iu/ui/un) is
 * pinned by a golden fixture in `double-pinyin.test.ts`.
 *
 * Input is the ASCII full pinyin stored in the corpus: no tone marks, and `ü`
 * written `v` (女 → "nv", 略 → "lve"). j/q/x + written `u` is ü and is remapped
 * before the final lookup.
 */

const TWO_LETTER_INITIALS = ["zh", "ch", "sh"] as const;

/** 声母 → key. zh/ch/sh take the v/i/u keys; everything else is itself. */
const INITIAL_KEY: Record<string, string> = {
  zh: "v",
  ch: "i",
  sh: "u",
  b: "b",
  p: "p",
  m: "m",
  f: "f",
  d: "d",
  t: "t",
  n: "n",
  l: "l",
  g: "g",
  k: "k",
  h: "h",
  j: "j",
  q: "q",
  x: "x",
  r: "r",
  z: "z",
  c: "c",
  s: "s",
};

/** 韵母 (written form, after the j/q/x ü-remap) → key. */
const FINAL_KEY: Record<string, string> = {
  a: "a",
  o: "o",
  e: "e",
  i: "i",
  u: "u",
  v: "v",
  ai: "d",
  ei: "w",
  ui: "v",
  ao: "c",
  ou: "z",
  iu: "q",
  ie: "p",
  ve: "t",
  an: "j",
  en: "f",
  in: "b",
  un: "y",
  vn: "y",
  ang: "h",
  eng: "g",
  ing: "k",
  ong: "s",
  ia: "x",
  iao: "n",
  ian: "m",
  iang: "l",
  iong: "s",
  ua: "x",
  uo: "o",
  uai: "k",
  uan: "r",
  van: "r",
  uang: "l",
  ue: "t",
};

/**
 * Zero-initial syllables (start with a/o/e). Flypy rule: single vowels double
 * (a→aa); otherwise the leading vowel keys the "initial" slot and the whole
 * final keys the second slot (爱 ai → a + d). `er` is its own two-letter code.
 */
const ZERO_SYLLABLE: Record<string, string> = {
  a: "aa",
  o: "oo",
  e: "ee",
  er: "er",
  ai: "ad",
  ei: "ew",
  ao: "ac",
  ou: "oz",
  an: "aj",
  en: "ef",
  ang: "ah",
  eng: "eg",
};

/**
 * y/w syllables. y/w are glides, not real initials — the phonetic final carries
 * the medial (you → iou, wang → uang, yuan → üan). Encoded directly so the
 * written→phonetic step can't drift.
 */
const YW_SYLLABLE: Record<string, string> = {
  yi: "yi",
  ya: "yx",
  ye: "yp",
  yao: "yn",
  you: "yq",
  yan: "ym",
  yin: "yb",
  yang: "yl",
  ying: "yk",
  yong: "ys",
  yu: "yv",
  yue: "yt",
  yuan: "yr",
  yun: "yy",
  yo: "yo",
  wu: "wu",
  wa: "wx",
  wo: "wo",
  wai: "wk",
  wei: "wv",
  wan: "wr",
  wen: "wy",
  wang: "wl",
  weng: "wg",
};

/** Split a consonant-initial syllable into initial + written final. */
export function splitInitialFinal(pinyin: string): { initial: string; final: string } {
  for (const two of TWO_LETTER_INITIALS) {
    if (pinyin.startsWith(two)) return { initial: two, final: pinyin.slice(2) };
  }
  const c = pinyin[0];
  if (c !== undefined && "bpmfdtnlgkhjqxrzcs".includes(c)) {
    return { initial: c, final: pinyin.slice(1) };
  }
  return { initial: "", final: pinyin };
}

/**
 * Convert one ASCII full pinyin syllable to its 小鹤 two-key code. Throws on an
 * unrecognised syllable so a bad corpus entry fails loud at layout time rather
 * than silently marking the user wrong.
 */
export function toXiaohe(pinyin: string): string {
  const p = pinyin.toLowerCase();
  if (p.length === 0) {
    throw new Error("toXiaohe requires a non-empty pinyin");
  }
  const zero = ZERO_SYLLABLE[p];
  if (zero !== undefined) return zero;
  if (p[0] === "y" || p[0] === "w") {
    const yw = YW_SYLLABLE[p];
    if (yw === undefined) throw new Error(`unhandled y/w syllable: ${p}`);
    return yw;
  }
  const { initial, final } = splitInitialFinal(p);
  const ik = INITIAL_KEY[initial];
  if (ik === undefined) throw new Error(`unknown initial in pinyin: ${p}`);
  // After j/q/x, a written `u` is really ü — remap to the v-forms so the final
  // lookup lands on the ü keys (ju→jv, jue→jt, juan→jr, jun→jy).
  let f = final;
  if (initial === "j" || initial === "q" || initial === "x") {
    if (f === "u") f = "v";
    else if (f === "ue") f = "ve";
    else if (f === "uan") f = "van";
    else if (f === "un") f = "vn";
  }
  const fk = FINAL_KEY[f];
  if (fk === undefined) throw new Error(`unknown final "${final}" in pinyin: ${p}`);
  return ik + fk;
}
