import type { InputSegment } from "../corpus";
import type { Step } from "../typing/types";
import { syllableToKeys } from "./layout";
import { isValidSyllable } from "./syllables";
import type { PinyinScheme } from "./types";

/**
 * Confusable-syllable classification — the engine half of P3's "错误分类训练".
 *
 * Learners of Mandarin pinyin systematically confuse three phonetic contrasts:
 *
 *  - `nasal`     前后鼻音 — the -n / -ng finals (in↔ing, en↔eng, an↔ang, and
 *                the medial forms ian↔iang, uan↔uang).
 *  - `retroflex` 平翘舌 — the dental / retroflex initials (z↔zh, c↔ch, s↔sh).
 *  - `nl`        边鼻音 — the n / l initials (那 nà ↔ 拉 lā).
 *
 * These modules are pure: given the *expected* pinyin of a character and what
 * the user actually typed, decide whether a mistake is one of these confusions
 * (vs a random typo). Detection compares the typed key run against the keys of
 * a plausible confusable *variant* of the expected syllable, so it never guesses
 * — it only fires when the substitution is exactly a known contrast.
 *
 * Note on scheme coverage: in `full` pinyin the nasal and retroflex variants
 * change the typed length (in→ing, z→zh), so against a fixed expected key run
 * only the equal-length `nl` contrast is detected passively; the drill channel
 * covers the rest actively. In the double-pinyin schemes every syllable is two
 * keys, so all three contrasts become equal-length key swaps and are detected.
 */
export type ConfusionKind = "nasal" | "retroflex" | "nl";

/** Human labels (Chinese) for each confusion family — for UI surfaces. */
export const CONFUSION_LABELS: Readonly<Record<ConfusionKind, string>> = {
  nasal: "前后鼻音",
  retroflex: "平翘舌",
  nl: "边鼻音 n/l",
};

export const CONFUSION_KINDS: readonly ConfusionKind[] = ["nasal", "retroflex", "nl"];

/** A hypothetical mistyped syllable and the contrast it represents. */
export interface ConfusionVariant {
  readonly pinyin: string;
  readonly kind: ConfusionKind;
}

/** Toggle the -n / -ng nasal ending, or null if the syllable has no such ending. */
function nasalSwap(pinyin: string): string | null {
  // 3-letter nasal endings lose their g; 2-letter ones gain it. `ong`/`iong`
  // are excluded — the 前后鼻音 contrast is about an/en/in, not ong.
  if (pinyin.endsWith("ing")) return `${pinyin.slice(0, -3)}in`;
  if (pinyin.endsWith("eng")) return `${pinyin.slice(0, -3)}en`;
  if (pinyin.endsWith("ang")) return `${pinyin.slice(0, -3)}an`;
  if (pinyin.endsWith("in")) return `${pinyin.slice(0, -2)}ing`;
  if (pinyin.endsWith("en")) return `${pinyin.slice(0, -2)}eng`;
  if (pinyin.endsWith("an")) return `${pinyin.slice(0, -2)}ang`;
  return null;
}

/** Toggle a dental/retroflex initial (z↔zh, c↔ch, s↔sh), or null if neither. */
function retroflexSwap(pinyin: string): string | null {
  if (pinyin.startsWith("zh")) return `z${pinyin.slice(2)}`;
  if (pinyin.startsWith("ch")) return `c${pinyin.slice(2)}`;
  if (pinyin.startsWith("sh")) return `s${pinyin.slice(2)}`;
  const c = pinyin[0];
  if (c === "z" || c === "c" || c === "s") return `${c}h${pinyin.slice(1)}`;
  return null;
}

/** Toggle an n / l initial, or null if the syllable starts with neither. */
function nlSwap(pinyin: string): string | null {
  if (pinyin.startsWith("n")) return `l${pinyin.slice(1)}`;
  if (pinyin.startsWith("l")) return `n${pinyin.slice(1)}`;
  return null;
}

/**
 * The confusable variants of a syllable — one per applicable contrast. A given
 * syllable usually yields zero, one or two (e.g. 娘 niang → both 边鼻音 liang
 * and 前后鼻音 nian).
 *
 * Only variants that are *real* syllables are returned. A mechanical swap can
 * produce an unattested form (mian → miang, song → shong) that a double-pinyin
 * converter would still happily encode; emitting it would let a plain key slip
 * be mislabeled as a confusion, so it is filtered against the syllable
 * inventory (Codex review, 2026-09-19).
 */
export function confusableVariants(pinyin: string): ConfusionVariant[] {
  const p = pinyin.toLowerCase();
  const out: ConfusionVariant[] = [];
  const push = (variant: string | null, kind: ConfusionKind): void => {
    if (variant !== null && isValidSyllable(variant)) out.push({ pinyin: variant, kind });
  };
  push(retroflexSwap(p), "retroflex");
  push(nasalSwap(p), "nasal");
  push(nlSwap(p), "nl");
  return out;
}

/**
 * Classify a single mistyped character. `expected` is its full pinyin;
 * `typedKeys` is what the user actually typed for that character (the key run
 * over the character's segment). Returns the confusion family when `typedKeys`
 * exactly matches a confusable variant's keys, else null (a plain typo).
 */
export function classifyConfusion(
  expected: string,
  typedKeys: string,
  scheme: PinyinScheme,
): ConfusionKind | null {
  let expectedKeys: string;
  try {
    expectedKeys = syllableToKeys(expected, scheme);
  } catch {
    return null;
  }
  if (typedKeys === expectedKeys) return null;
  for (const variant of confusableVariants(expected)) {
    let vk: string;
    try {
      vk = syllableToKeys(variant.pinyin, scheme);
    } catch {
      continue;
    }
    if (vk === typedKeys) return variant.kind;
  }
  return null;
}

/** Per-family confusion counts for one run, plus the confused syllables. */
export interface ConfusionTally {
  readonly counts: Readonly<Record<ConfusionKind, number>>;
  /** Expected pinyin of every character that drew a confusion, with its family. */
  readonly hits: ReadonlyArray<{ expected: string; kind: ConfusionKind }>;
}

/**
 * Reconstruct what the user actually typed at each expected position from the
 * keystroke log. Later steps at the same position win (a backspace-and-retype
 * lands its final value); positions never reached stay as `\0` so they can
 * never coincidentally match a variant key.
 */
function typedByPosition(steps: readonly Step[], length: number): string[] {
  const chars = new Array<string>(length).fill("\0");
  for (const step of steps) {
    if (step.position >= 0 && step.position < length) {
      chars[step.position] = step.typed;
    }
  }
  return chars;
}

/**
 * Tally the confusion families across one finished Chinese run. Walks each
 * display segment (one hanzi), reconstructs the typed key run for that
 * character, and classifies any mismatch. `keysLength` is the length of the
 * passage's flat key string (`typing.expected`).
 */
export function tallyConfusions(
  segments: readonly InputSegment[],
  steps: readonly Step[],
  keysLength: number,
  scheme: PinyinScheme,
): ConfusionTally {
  const counts: Record<ConfusionKind, number> = { nasal: 0, retroflex: 0, nl: 0 };
  const hits: Array<{ expected: string; kind: ConfusionKind }> = [];
  const typed = typedByPosition(steps, keysLength);
  for (const seg of segments) {
    // The cell's full pinyin is the `note` (double-pinyin) or the `hint`
    // (full pinyin, where hint === the typed keys). Skip segments without one.
    const expected = seg.note ?? seg.hint;
    if (expected === undefined) continue;
    const typedKeys = typed.slice(seg.start, seg.end).join("");
    if (typedKeys.includes("\0")) continue; // character not fully typed
    const kind = classifyConfusion(expected, typedKeys, scheme);
    if (kind !== null) {
      counts[kind]++;
      hits.push({ expected, kind });
    }
  }
  return { counts, hits };
}
