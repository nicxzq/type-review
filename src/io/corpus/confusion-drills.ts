import type { Passage } from "../../engine/corpus";
import { lengthScore, makePassage } from "../../engine/corpus";
import type { ConfusionKind, PinyinCell, PinyinScheme } from "../../engine/pinyin";
import { buildChineseLayout } from "../../engine/pinyin";

/**
 * Curated minimal-pair drills — the active half of P3's "错误分类训练". Each
 * family is a list of contrasting pairs a Mandarin learner routinely confuses;
 * a drill interleaves the pair members so the contrast is drilled back-to-back
 * (那 nà 拉 lā 男 nán 兰 lán …). All hanzi are single, common, single-reading
 * characters; pinyin is ASCII (no tones, ü as v) so it flows through the same
 * {@link buildChineseLayout} the general corpus uses.
 *
 * Pairs are flattened in order, so the typed passage alternates the two sides
 * of the contrast. The engine's {@link classifyConfusion} then labels any slip
 * back to the family being drilled.
 */
const DRILL_PAIRS: Readonly<
  Record<ConfusionKind, ReadonlyArray<readonly [PinyinCell, PinyinCell]>>
> = {
  // 前后鼻音: -n vs -ng.
  nasal: [
    [
      { hanzi: "民", pinyin: "min" },
      { hanzi: "明", pinyin: "ming" },
    ],
    [
      { hanzi: "心", pinyin: "xin" },
      { hanzi: "星", pinyin: "xing" },
    ],
    [
      { hanzi: "金", pinyin: "jin" },
      { hanzi: "京", pinyin: "jing" },
    ],
    [
      { hanzi: "亲", pinyin: "qin" },
      { hanzi: "青", pinyin: "qing" },
    ],
    [
      { hanzi: "林", pinyin: "lin" },
      { hanzi: "铃", pinyin: "ling" },
    ],
    [
      { hanzi: "分", pinyin: "fen" },
      { hanzi: "风", pinyin: "feng" },
    ],
    [
      { hanzi: "陈", pinyin: "chen" },
      { hanzi: "成", pinyin: "cheng" },
    ],
    [
      { hanzi: "真", pinyin: "zhen" },
      { hanzi: "争", pinyin: "zheng" },
    ],
  ],
  // 平翘舌: z/c/s vs zh/ch/sh.
  retroflex: [
    [
      { hanzi: "四", pinyin: "si" },
      { hanzi: "是", pinyin: "shi" },
    ],
    [
      { hanzi: "子", pinyin: "zi" },
      { hanzi: "之", pinyin: "zhi" },
    ],
    [
      { hanzi: "早", pinyin: "zao" },
      { hanzi: "找", pinyin: "zhao" },
    ],
    [
      { hanzi: "草", pinyin: "cao" },
      { hanzi: "超", pinyin: "chao" },
    ],
    [
      { hanzi: "三", pinyin: "san" },
      { hanzi: "山", pinyin: "shan" },
    ],
    [
      { hanzi: "从", pinyin: "cong" },
      { hanzi: "冲", pinyin: "chong" },
    ],
    [
      { hanzi: "赛", pinyin: "sai" },
      { hanzi: "晒", pinyin: "shai" },
    ],
    [
      { hanzi: "走", pinyin: "zou" },
      { hanzi: "周", pinyin: "zhou" },
    ],
  ],
  // 边鼻音: n vs l.
  nl: [
    [
      { hanzi: "那", pinyin: "na" },
      { hanzi: "拉", pinyin: "la" },
    ],
    [
      { hanzi: "男", pinyin: "nan" },
      { hanzi: "兰", pinyin: "lan" },
    ],
    [
      { hanzi: "牛", pinyin: "niu" },
      { hanzi: "流", pinyin: "liu" },
    ],
    [
      { hanzi: "女", pinyin: "nv" },
      { hanzi: "吕", pinyin: "lv" },
    ],
    [
      { hanzi: "脑", pinyin: "nao" },
      { hanzi: "老", pinyin: "lao" },
    ],
    [
      { hanzi: "你", pinyin: "ni" },
      { hanzi: "里", pinyin: "li" },
    ],
    [
      { hanzi: "年", pinyin: "nian" },
      { hanzi: "连", pinyin: "lian" },
    ],
    [
      { hanzi: "内", pinyin: "nei" },
      { hanzi: "类", pinyin: "lei" },
    ],
  ],
};

/** The confusion families exposed as drills, in display order. Re-exported for UI. */
export const DRILL_FAMILIES: readonly ConfusionKind[] = ["nasal", "retroflex", "nl"];

/** Flatten a family's pairs into a single interleaved cell run. */
function drillCells(family: ConfusionKind): PinyinCell[] {
  return DRILL_PAIRS[family].flatMap(([a, b]) => [a, b]);
}

export interface ConfusionDrillSource {
  /**
   * Build a drill passage for `family` (or a random family when omitted),
   * laid out for the current scheme. `wantedChars` weights the pick when a
   * family is not pinned; a single family currently yields one passage, so the
   * weight only matters once families gain length variants.
   */
  pick(wantedChars: number, rng: () => number, family?: ConfusionKind): Passage;
}

/**
 * Confusion-drill corpus source. Parallels {@link createChineseSource}: the
 * passage `text` is the flat pinyin key string and the hanzi ride in
 * `segments`. Layout is built at pick time from the active scheme, so flipping
 * full ⇄ 双拼 takes effect on the next run.
 *
 * @param getScheme reads the active pinyin scheme; defaults to full.
 */
export function createConfusionDrillSource(
  getScheme: () => PinyinScheme = () => "full",
): ConfusionDrillSource {
  const passageFor = (family: ConfusionKind, scheme: PinyinScheme): Passage => {
    const layout = buildChineseLayout(drillCells(family), scheme);
    return makePassage(`zh-confusion-${family}`, layout.keys, layout.segments);
  };

  return {
    pick(wantedChars, rng, family): Passage {
      const scheme = getScheme();
      if (family !== undefined) return passageFor(family, scheme);
      // No family pinned: weight the families by how close their length is to
      // wantedChars (they're similar, so this is near-uniform) and pick one.
      const passages = DRILL_FAMILIES.map((f) => passageFor(f, scheme));
      const weights = passages.map((p) => Math.max(0.01, lengthScore(p.text.length, wantedChars)));
      const total = weights.reduce((sum, w) => sum + w, 0);
      let pick = rng() * total;
      for (let i = 0; i < passages.length; i++) {
        pick -= weights[i] ?? 0;
        if (pick <= 0) return passages[i] as Passage;
      }
      return passages[passages.length - 1] as Passage;
    },
  };
}
