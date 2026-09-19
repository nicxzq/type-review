import type { InputSegment, Passage } from "./types";

const LETTER = /\p{Letter}/u;

/** Counts letters (lowercased) in `text`, ignoring spaces, digits and punctuation. */
export function analyzeText(text: string): {
  keyHistogram: Record<string, number>;
  letterCount: number;
} {
  const keyHistogram: Record<string, number> = {};
  let letterCount = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) {
      continue;
    }
    const lower = ch.toLowerCase();
    keyHistogram[lower] = (keyHistogram[lower] ?? 0) + 1;
    letterCount++;
  }
  return { keyHistogram, letterCount };
}

/**
 * Builds a fully tagged Passage from raw text. `segments` is optional — pass it
 * for Chinese passages (one display segment per hanzi over the pinyin `text`);
 * omit it for Latin passages, which render one span per character.
 */
export function makePassage(id: string, text: string, segments?: readonly InputSegment[]): Passage {
  if (text.length === 0) {
    throw new Error("passage text must be non-empty");
  }
  const { keyHistogram, letterCount } = analyzeText(text);
  return { id, text, keyHistogram, letterCount, ...(segments ? { segments } : {}) };
}
