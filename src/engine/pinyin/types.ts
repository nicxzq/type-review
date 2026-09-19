import type { InputSegment } from "../corpus";

/**
 * Pinyin input scheme. `full` = type the whole romanisation (zhong → z h o n g).
 * `xiaohe` = 小鹤 double-pinyin (two keys per syllable). P1 implements `full`
 * only; the enum carries `xiaohe` so settings/persistence are forward-compatible
 * and the P1b double-pinyin work is a drop-in.
 */
export type PinyinScheme = "full" | "xiaohe";

/**
 * One Chinese display unit: a single hanzi and its canonical romanisation.
 *
 * `pinyin` is the ASCII-typeable full pinyin the user actually types on an
 * English keyboard — no tone marks, and `ü` is written `v` (女 → "nv",
 * 略 → "lve"). This keeps the flat key string in the Basic Latin range so the
 * existing `TextInput` (which indexes by UTF-16 code unit and rejects non-BMP
 * input) handles it unchanged.
 */
export interface PinyinCell {
  readonly hanzi: string;
  readonly pinyin: string;
}

/**
 * The result of laying out a run of {@link PinyinCell}s for a given scheme:
 * the flat key string that gets typed, plus generic {@link InputSegment}s that
 * map key ranges back to their display hanzi and pinyin hint for the UI.
 *
 * `keys` is what feeds `TextInput.expected`; `segments[i]` covers
 * `[start, end)` of `keys` and carries `display` (hanzi) + `hint` (pinyin).
 */
export interface ChineseLayout {
  readonly keys: string;
  readonly segments: readonly InputSegment[];
}
