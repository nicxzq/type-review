/** Which letters a lesson may use and which one to over-represent. */
export interface Filter {
  /**
   * Letters this lesson may produce, in difficulty order (easiest first).
   * Modeled as an array (not a Set) because the order is meaningful — future
   * generators may bias toward easier letters — and array membership lookup
   * is O(n) on a ~26-letter alphabet, i.e. free.
   */
  allowed: readonly string[];
  /** The weakest letter — text should over-represent it. null when none is weak. */
  focus: string | null;
}

/**
 * A range of the typed `text` that forms one logical display unit, decoupling
 * "what is displayed" from "what is typed". Latin passages leave this unset
 * (one span per character is the default render). Chinese passages set one
 * segment per hanzi: `[start, end)` covers that hanzi's pinyin keys, `display`
 * is the hanzi, `hint` is the pinyin shown above it.
 *
 * The engine stays script-agnostic — it only knows key ranges and opaque
 * display/hint strings. Filling `display`/`hint` with hanzi/pinyin is the io
 * layer's job; the same abstraction can later drive word-level highlighting for
 * Latin text.
 */
export interface InputSegment {
  readonly start: number;
  readonly end: number;
  readonly display?: string;
  /** Primary label above the segment — the exact keys typed for this unit. */
  readonly hint?: string;
  /**
   * Secondary muted label. For 小鹤 double-pinyin the `hint` is the two typed
   * keys while `note` carries the full pinyin so the reading is still visible.
   * Unset for full pinyin (the hint already is the full pinyin).
   */
  readonly note?: string;
}

/** A pre-tagged unit of practice text. */
export interface Passage {
  id: string;
  /** The text to type, with natural capitalisation and punctuation preserved. */
  text: string;
  /**
   * Per-letter counts within `text` (lowercased, letters only). Pre-computed so
   * lookups stay a pure, fast operation at runtime.
   */
  keyHistogram: Readonly<Record<string, number>>;
  /** Sum of keyHistogram values — total typeable letters in `text`. */
  letterCount: number;
  /**
   * Optional display segments over `text` (see {@link InputSegment}). Present
   * for Chinese passages (one per hanzi); absent for Latin passages.
   */
  segments?: readonly InputSegment[];
}
