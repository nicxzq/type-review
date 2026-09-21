import type { InputSegment } from "../corpus";
import { toXiaohe } from "./double-pinyin";
import type { ChineseLayout, PinyinCell, PinyinScheme } from "./types";
import { toZiranma } from "./ziranma";

/**
 * Per-scheme syllable → key converter. `full` types the pinyin verbatim; the
 * double-pinyin schemes look up their two-key code. Throws (via the underlying
 * converter) on a syllable the scheme can't encode — callers probing
 * hypothetical variants should catch.
 */
export function syllableToKeys(full: string, scheme: PinyinScheme): string {
  switch (scheme) {
    case "xiaohe":
      return toXiaohe(full);
    case "ziranma":
      return toZiranma(full);
    default:
      return full;
  }
}

/** Basic-Latin lowercase only — the ASCII form the user types (ü is written v). */
const ASCII_PINYIN = /^[a-z]+$/;

/**
 * Lay out a run of {@link PinyinCell}s into the flat key string typed by the
 * user plus one {@link InputSegment} per hanzi.
 *
 *  - `full`             — the keys of a cell are its `pinyin` verbatim; `hint`
 *                         is the pinyin, no `note`.
 *  - `xiaohe`/`ziranma` — the keys are the double-pinyin two-key code; `hint`
 *                         is that code (what the user types, coloured per key)
 *                         and `note` is the full pinyin so the reading stays
 *                         visible.
 *
 * Fails loud on malformed input (empty cell list, empty/non-ASCII pinyin) so a
 * bad corpus entry surfaces at the boundary instead of desyncing the cursor.
 */
export function buildChineseLayout(
  cells: readonly PinyinCell[],
  scheme: PinyinScheme = "full",
): ChineseLayout {
  if (cells.length === 0) {
    throw new Error("buildChineseLayout requires at least one cell");
  }
  let keys = "";
  const segments: InputSegment[] = [];
  for (const cell of cells) {
    const full = cell.pinyin.toLowerCase();
    if (!ASCII_PINYIN.test(full)) {
      throw new Error(`pinyin must be ASCII a-z (ü as v): got "${cell.pinyin}" for ${cell.hanzi}`);
    }
    const k = syllableToKeys(full, scheme);
    const start = keys.length;
    keys += k;
    segments.push({
      start,
      end: keys.length,
      display: cell.hanzi,
      hint: k,
      ...(scheme === "full" ? {} : { note: cell.pinyin }),
    });
  }
  return { keys, segments };
}
