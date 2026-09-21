type CellLike = string | { readonly pinyin: string };

function pinyinOf(cell: CellLike): string {
  return (typeof cell === "string" ? cell : cell.pinyin).toLowerCase();
}

/**
 * Builds the pinyin-syllable curriculum order from corpus cells.
 *
 * The engine only sees plain pinyin data: io decides where it came from
 * (`zh.json`, tests, or a future custom source). Higher-frequency syllables
 * unlock first; ties sort alphabetically for deterministic plans.
 */
export function buildSyllableInventory(
  entries: readonly (readonly CellLike[])[],
): readonly string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const cell of entry) {
      const pinyin = pinyinOf(cell);
      if (pinyin.length === 0) continue;
      counts.set(pinyin, (counts.get(pinyin) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pinyin]) => pinyin);
}
