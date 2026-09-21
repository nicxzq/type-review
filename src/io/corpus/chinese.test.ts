import { describe, expect, it } from "vitest";
import { buildChineseLayout, type PinyinScheme } from "../../engine/pinyin";
import { mulberry32 } from "../../engine/rng";
import { createChineseSource, ZH_ENTRIES } from "./chinese";

const ASCII_PINYIN = /^[a-z]+$/;
const SINGLE_BMP = /^[一-鿿]$/;
const SCHEMES: readonly PinyinScheme[] = ["full", "xiaohe", "ziranma"];

describe("zh.json data contract", () => {
  it("has at least one entry", () => {
    expect(ZH_ENTRIES.length).toBeGreaterThan(0);
  });

  for (const entry of ZH_ENTRIES) {
    describe(entry.id, () => {
      it("has a zh- id, a license, and non-empty cells", () => {
        expect(entry.id.startsWith("zh-")).toBe(true);
        expect(entry.license.length).toBeGreaterThan(0);
        expect(entry.cells.length).toBeGreaterThan(0);
      });

      it("every cell is a single BMP hanzi with ASCII pinyin (ü as v, no tones)", () => {
        for (const cell of entry.cells) {
          expect(cell.h, `hanzi "${cell.h}"`).toMatch(SINGLE_BMP);
          expect(cell.p, `pinyin "${cell.p}" for ${cell.h}`).toMatch(ASCII_PINYIN);
        }
      });

      it("builds an ASCII layout whose segments cover the string in every scheme", () => {
        const cells = entry.cells.map((c) => ({ hanzi: c.h, pinyin: c.p }));
        // Every syllable must be encodable by every scheme — a double-pinyin
        // converter throws on a syllable it can't handle, so this guards
        // against a corpus entry that only works in full pinyin.
        for (const scheme of SCHEMES) {
          const layout = buildChineseLayout(cells, scheme);
          expect(layout.keys, scheme).toMatch(ASCII_PINYIN);
          expect(layout.segments[0]?.start, scheme).toBe(0);
          expect(layout.segments.at(-1)?.end, scheme).toBe(layout.keys.length);
          expect(layout.segments.length, scheme).toBe(entry.cells.length);
        }
      });
    });
  }
});

describe("createChineseSource", () => {
  it("picks a passage carrying segments and a pinyin key string", () => {
    const source = createChineseSource();
    const passage = source.pick(60, mulberry32(1));
    expect(passage).not.toBeNull();
    expect(passage?.id.startsWith("zh-")).toBe(true);
    expect(passage?.text).toMatch(ASCII_PINYIN);
    expect(passage?.segments?.length).toBeGreaterThan(0);
    // The flat text is exactly the concatenation of every segment's slice.
    const joined = (passage?.segments ?? [])
      .map((s) => passage?.text.slice(s.start, s.end))
      .join("");
    expect(joined).toBe(passage?.text);
  });

  it("is deterministic for a fixed seed", () => {
    const a = createChineseSource().pick(60, mulberry32(42));
    const b = createChineseSource().pick(60, mulberry32(42));
    expect(a?.id).toBe(b?.id);
  });

  it("adaptively filters to passages fully covered by included syllables", () => {
    const source = createChineseSource();
    const included = new Set(["wen", "gu", "er", "zhi", "xin"]);
    const passage = source.pickAdaptive(20, mulberry32(1), { included, focus: "zhi" });
    expect(passage?.id).toBe("zh-wengu");
    expect(
      ZH_ENTRIES.find((entry) => entry.id === passage?.id)?.cells.every((cell) =>
        included.has(cell.p),
      ),
    ).toBe(true);
  });

  it("falls back to the entry with the fewest locked syllables when none is fully covered", () => {
    const source = createChineseSource();
    const included = new Set(["shi", "zhi"]);
    const passage = source.pickAdaptive(20, mulberry32(1), { included, focus: "shi" });
    const lockedCount = (entryId: string): number => {
      const entry = ZH_ENTRIES.find((candidate) => candidate.id === entryId);
      if (entry === undefined) return Number.POSITIVE_INFINITY;
      return entry.cells.filter((cell) => !included.has(cell.p)).length;
    };
    const expectedMin = Math.min(...ZH_ENTRIES.map((entry) => lockedCount(entry.id)));
    expect(passage).not.toBeNull();
    expect(lockedCount(passage?.id ?? "")).toBe(expectedMin);
  });
});
