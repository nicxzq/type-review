import type { InputSegment } from "../corpus";
import { toXiaohe } from "./double-pinyin";
import type { ChineseLayout, PinyinCell, PinyinScheme } from "./types";

/** Basic-Latin lowercase only — the ASCII form the user types (ü is written v). */
const ASCII_PINYIN = /^[a-z]+$/;

/**
 * Lay out a run of {@link PinyinCell}s into the flat key string typed by the
 * user plus one {@link InputSegment} per hanzi.
 *
 *  - `full`   — the keys of a cell are its `pinyin` verbatim; `hint` is the
 *               pinyin, no `note`.
 *  - `xiaohe` — the keys are the 小鹤 two-key code; `hint` is that code (what
 *               the user types, coloured per key) and `note` is the full pinyin
 *               so the reading stays visible.
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
    const k = scheme === "xiaohe" ? toXiaohe(full) : full;
    const start = keys.length;
    keys += k;
    segments.push({
      start,
      end: keys.length,
      display: cell.hanzi,
      hint: k,
      ...(scheme === "xiaohe" ? { note: cell.pinyin } : {}),
    });
  }
  return { keys, segments };
}
