import type { Passage } from "../../engine/corpus";
import { lengthScore, makePassage } from "../../engine/corpus";
import type { PinyinScheme } from "../../engine/pinyin";
import { buildChineseLayout } from "../../engine/pinyin";
import zhData from "./data/zh.json";

/** Raw shape of one cell in `data/zh.json` — a hanzi and its ASCII full pinyin. */
interface RawZhCell {
  h: string;
  p: string;
}

/** Raw shape of one Chinese passage entry in `data/zh.json`. */
export interface RawZhEntry {
  id: string;
  title?: string;
  license: string;
  cells: RawZhCell[];
}

/** The bundled Chinese corpus, typed. Exported for the data-contract test. */
export const ZH_ENTRIES = zhData as readonly RawZhEntry[];

export interface ChineseSource {
  /**
   * Pick one Chinese passage, weighted toward `wantedChars` key-length. Returns
   * a {@link Passage} whose `text` is the flat pinyin key string and whose
   * `segments` map each key range back to its hanzi + pinyin hint. Null only if
   * the corpus is empty.
   */
  pick(wantedChars: number, rng: () => number): Passage | null;
  pickAdaptive(
    wantedChars: number,
    rng: () => number,
    options: { included: ReadonlySet<string>; focus: string | null },
  ): Passage | null;
}

/**
 * Chinese corpus source. Bypasses the Latin `static-source` (which assumes
 * `text` is what you type *and* what you read); here `text` is the pinyin the
 * user types while the hanzi live in `segments`.
 *
 * The layout is built at `pick` time (once per run) from the current scheme, so
 * flipping full ⇄ 小鹤 in Settings takes effect on the next run without
 * rebuilding the source. Only a handful of short entries, so this stays cheap.
 *
 * @param getScheme reads the active pinyin scheme; defaults to full.
 */
export function createChineseSource(getScheme: () => PinyinScheme = () => "full"): ChineseSource {
  const cellsById = ZH_ENTRIES.map((entry) => ({
    id: entry.id,
    cells: entry.cells.map((c) => ({ hanzi: c.h, pinyin: c.p })),
  }));

  const toPassage = (entry: (typeof cellsById)[number]): Passage => {
    const layout = buildChineseLayout(entry.cells, getScheme());
    return makePassage(entry.id, layout.keys, layout.segments);
  };

  const pickWeighted = (
    entries: readonly (typeof cellsById)[number][],
    wantedChars: number,
    rng: () => number,
    focus: string | null = null,
  ): Passage | null => {
    if (entries.length === 0) return null;
    const passages = entries.map((entry) => ({
      entry,
      passage: toPassage(entry),
    }));
    const weights = passages.map(({ entry, passage }) => {
      const base = Math.max(0.01, lengthScore(passage.text.length, wantedChars));
      const hasFocus = focus !== null && entry.cells.some((cell) => cell.pinyin === focus);
      return hasFocus ? base * 3 : base;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let pick = rng() * total;
    for (let i = 0; i < passages.length; i++) {
      pick -= weights[i] ?? 0;
      if (pick <= 0) {
        const item = passages[i];
        if (item !== undefined) return item.passage;
      }
    }
    return passages[passages.length - 1]?.passage ?? null;
  };

  return {
    pick(wantedChars, rng): Passage | null {
      if (cellsById.length === 0) return null;
      // Same triangular length-weighting as the Latin sources, with a small
      // floor so a wantedChars far from every (short) passage still picks one
      // rather than dividing by zero.
      return pickWeighted(cellsById, wantedChars, rng);
    },
    pickAdaptive(wantedChars, rng, { included, focus }): Passage | null {
      if (cellsById.length === 0) return null;
      const unlocked = cellsById.filter((entry) =>
        entry.cells.every((cell) => included.has(cell.pinyin)),
      );
      if (unlocked.length > 0) {
        return pickWeighted(unlocked, wantedChars, rng, focus);
      }
      const lockedCounts = cellsById.map((entry) => ({
        entry,
        locked: entry.cells.filter((cell) => !included.has(cell.pinyin)).length,
      }));
      const minLocked = Math.min(...lockedCounts.map((item) => item.locked));
      return pickWeighted(
        lockedCounts.filter((item) => item.locked === minLocked).map((item) => item.entry),
        wantedChars,
        rng,
        focus,
      );
    },
  };
}
