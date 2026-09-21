/**
 * 自然码双拼 (Ziranma / Natural Code) conversion: full pinyin → two keys.
 *
 * Like {@link toXiaohe}, correctness is load-bearing — a wrong key silently
 * marks the user's correct input as a typo — so the maps below encode the
 * authoritative 自然码 layout (Rime `double_pinyin.schema.yaml`, whose base
 * scheme *is* 自然码; 微软双拼 differs only in `ing`). Every tricky class
 * (zero-initial, y/w, ü after j/q/x, whole-reading zhi/chi/shi) is pinned by a
 * golden fixture in `ziranma.test.ts`.
 *
 * 自然码 is structurally simpler than 小鹤: y and w are typed as *literal*
 * first keys carrying the written final (you → y + ou = "yb", wang → w + ang =
 * "wh"), with no phonetic glide restoration. Only a lone written `u` after
 * j/q/x/y is really ü and is remapped before the final lookup.
 *
 * Input is the ASCII full pinyin stored in the corpus: no tone marks, and `ü`
 * written `v` (女 → "nv", 略 → "lve").
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

/** 韵母 (written form, after the j/q/x/y ü-remap) → key. */
const FINAL_KEY: Record<string, string> = {
  a: "a",
  o: "o",
  e: "e",
  i: "i",
  u: "u",
  v: "v",
  ai: "l",
  ei: "z",
  ao: "k",
  ou: "b",
  an: "j",
  en: "f",
  ang: "h",
  eng: "g",
  ong: "s",
  ia: "w",
  iao: "c",
  ie: "x",
  iu: "q",
  ian: "m",
  in: "n",
  iang: "d",
  ing: "y",
  iong: "s",
  ua: "w",
  uo: "o",
  uai: "y",
  ui: "v",
  uan: "r",
  un: "p",
  uang: "d",
  ue: "t",
  ve: "t",
  van: "r",
  vn: "p",
};

/**
 * Zero-initial syllables (written start a/o/e). 自然码 rule: single vowels
 * double (a → aa); `er` is its own code; every other final keys the leading
 * vowel then the whole written final (爱 ai → a + l = "al").
 */
const ZERO_SYLLABLE: Record<string, string> = {
  a: "aa",
  o: "oo",
  e: "ee",
  er: "er",
  ai: "al",
  ei: "ez",
  ao: "ak",
  ou: "ob",
  an: "aj",
  en: "ef",
  ang: "ah",
  eng: "eg",
};

/**
 * Convert one ASCII full pinyin syllable to its 自然码 two-key code. Throws on
 * an unrecognised syllable so a bad corpus entry fails loud at layout time
 * rather than silently marking the user wrong.
 */
export function toZiranma(pinyin: string): string {
  const p = pinyin.toLowerCase();
  if (p.length === 0) {
    throw new Error("toZiranma requires a non-empty pinyin");
  }
  const zero = ZERO_SYLLABLE[p];
  if (zero !== undefined) return zero;

  // Split off the initial. y/w are not real initials but 自然码 keys them
  // literally, so they take the initial slot verbatim (final is the remainder).
  let initialKey: string;
  let final: string;
  const two = TWO_LETTER_INITIALS.find((t) => p.startsWith(t));
  if (two !== undefined) {
    initialKey = INITIAL_KEY[two] as string;
    final = p.slice(2);
  } else if (p[0] === "y" || p[0] === "w") {
    initialKey = p[0];
    final = p.slice(1);
  } else {
    const c = p[0];
    if (c === undefined || !"bpmfdtnlgkhjqxrzcs".includes(c)) {
      throw new Error(`unknown initial in pinyin: ${p}`);
    }
    initialKey = INITIAL_KEY[c] as string;
    final = p.slice(1);
  }

  // A lone written `u` after j/q/x/y is really ü (居 ju → jü, 鱼 yu → yü) —
  // remap to `v` so the final lookup lands on the ü key. `w` is not in this set
  // (无 wu is a real u). ue/uan/un need no remap: their ü and u forms already
  // collapse to the same 自然码 key (t/r/p).
  if (final === "u" && "jqxy".includes(p[0] as string)) {
    final = "v";
  }

  const fk = FINAL_KEY[final];
  if (fk === undefined) throw new Error(`unknown final "${final}" in pinyin: ${p}`);
  return initialKey + fk;
}
