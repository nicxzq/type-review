import type { InputSegment } from "../corpus";
import type { Step } from "../typing";

/** Keep timing bounds identical to the adaptive bigram histogram. */
const MIN_PLAUSIBLE_MS = 40;
const MAX_PLAUSIBLE_MS = 12_000;

/**
 * Aggregates a completed Chinese run into per-full-pinyin mean timings.
 *
 * Each segment covers one hanzi's typed key range. We average clean,
 * plausible per-character timings within that range, then average repeated
 * syllables across the run. Non-adjacent step pairs are ignored so retries and
 * backspace jumps do not leak duplicated timing into the estimate.
 */
export function syllableTimesFromRun(
  segments: readonly InputSegment[],
  steps: readonly Step[],
): Record<string, number> {
  const bySyllable = new Map<string, { sum: number; count: number }>();
  const cleanPositions = new Map<number, number>();

  for (let i = 0; i < steps.length; i++) {
    const curr = steps[i];
    if (curr === undefined || curr.typo) continue;
    if (curr.timeToType < MIN_PLAUSIBLE_MS || curr.timeToType > MAX_PLAUSIBLE_MS) continue;
    if (i > 0) {
      const prev = steps[i - 1];
      if (prev !== undefined && curr.position !== prev.position + 1) continue;
    }
    cleanPositions.set(curr.position, curr.timeToType);
  }

  for (const segment of segments) {
    const pinyin = (segment.note ?? segment.hint)?.toLowerCase();
    if (pinyin === undefined || pinyin.length === 0) continue;
    let sum = 0;
    let count = 0;
    for (let position = segment.start; position < segment.end; position++) {
      const time = cleanPositions.get(position);
      if (time === undefined) continue;
      sum += time;
      count++;
    }
    if (count === 0) continue;
    const entry = bySyllable.get(pinyin) ?? { sum: 0, count: 0 };
    entry.sum += sum;
    entry.count += count;
    bySyllable.set(pinyin, entry);
  }

  const result: Record<string, number> = {};
  for (const [pinyin, entry] of bySyllable) {
    result[pinyin] = Math.round(entry.sum / entry.count);
  }
  return result;
}
