import type { AdaptiveSettings } from "../adaptive";
import { DEFAULT_ADAPTIVE_SETTINGS } from "../adaptive";
import { EmaFilter } from "../adaptive/ema";
import { EMA_ALPHA } from "../adaptive/key-stats";
import type { Target } from "../adaptive/target";

export interface ChineseSyllableStats {
  pinyin: string;
  timeToType: number | null;
  bestTimeToType: number | null;
}

export interface ChineseLessonSyllable {
  pinyin: string;
  included: boolean;
  focused: boolean;
  confidence: number | null;
  bestConfidence: number | null;
}

export interface ChineseLessonPlan {
  included: readonly string[];
  focus: string | null;
  syllables: readonly ChineseLessonSyllable[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function buildSyllableStatsMap(
  runs: readonly (Readonly<Record<string, number>> | undefined)[],
): Map<string, ChineseSyllableStats> {
  const filters = new Map<string, EmaFilter>();
  const best = new Map<string, number>();

  const filterOf = (pinyin: string): EmaFilter => {
    let filter = filters.get(pinyin);
    if (filter === undefined) {
      filter = new EmaFilter(EMA_ALPHA);
      filters.set(pinyin, filter);
    }
    return filter;
  };

  for (const run of runs) {
    if (run === undefined) continue;
    for (const [rawPinyin, timeToType] of Object.entries(run)) {
      if (!Number.isFinite(timeToType) || timeToType <= 0) continue;
      const pinyin = rawPinyin.toLowerCase();
      const filtered = filterOf(pinyin).add(timeToType);
      const prevBest = best.get(pinyin);
      if (prevBest === undefined || filtered < prevBest) {
        best.set(pinyin, filtered);
      }
    }
  }

  const result = new Map<string, ChineseSyllableStats>();
  for (const [pinyin, filter] of filters) {
    result.set(pinyin, {
      pinyin,
      timeToType: filter.value,
      bestTimeToType: best.get(pinyin) ?? null,
    });
  }
  return result;
}

export function planChineseLesson(
  inventory: readonly string[],
  syllableStats: ReadonlyMap<string, ChineseSyllableStats>,
  target: Target,
  settings: AdaptiveSettings = DEFAULT_ADAPTIVE_SETTINGS,
): ChineseLessonPlan {
  if (inventory.length === 0) {
    return { included: [], focus: null, syllables: [] };
  }
  const minSize = clamp(
    Math.round(settings.minAlphabetSize),
    Math.min(1, inventory.length),
    inventory.length,
  );
  const expansion = clamp(settings.alphabetExpansion, 0, 1);
  const maxSize = clamp(
    minSize + Math.round((inventory.length - minSize) * expansion),
    minSize,
    inventory.length,
  );

  const confidenceOf = (pinyin: string): number | null =>
    target.confidence(syllableStats.get(pinyin)?.timeToType ?? null);
  const bestConfidenceOf = (pinyin: string): number | null =>
    target.confidence(syllableStats.get(pinyin)?.bestTimeToType ?? null);
  const mastered = (confidence: number | null): boolean => confidence !== null && confidence >= 1;

  const included: string[] = [];
  for (const pinyin of inventory) {
    if (included.length < minSize) {
      included.push(pinyin);
      continue;
    }
    if (included.length < maxSize) {
      included.push(pinyin);
      continue;
    }
    if (mastered(bestConfidenceOf(pinyin))) {
      included.push(pinyin);
      continue;
    }
    if (included.every((s) => mastered(bestConfidenceOf(s)))) {
      included.push(pinyin);
      continue;
    }
    break;
  }

  const includedSet = new Set(included);
  let focus: string | null = null;
  let focusScore = Infinity;
  for (const pinyin of included) {
    const confidence = confidenceOf(pinyin);
    if (confidence !== null && confidence >= 1) continue;
    const score = confidence ?? -Infinity;
    if (score < focusScore) {
      focusScore = score;
      focus = pinyin;
    }
  }

  return {
    included,
    focus,
    syllables: inventory.map((pinyin) => ({
      pinyin,
      included: includedSet.has(pinyin),
      focused: pinyin === focus,
      confidence: confidenceOf(pinyin),
      bestConfidence: bestConfidenceOf(pinyin),
    })),
  };
}
