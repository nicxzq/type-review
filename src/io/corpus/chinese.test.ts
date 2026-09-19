import { describe, expect, it } from "vitest";
import { buildChineseLayout } from "../../engine/pinyin";
import { mulberry32 } from "../../engine/rng";
import { createChineseSource, ZH_ENTRIES } from "./chinese";

const ASCII_PINYIN = /^[a-z]+$/;
const SINGLE_BMP = /^[一-鿿]$/;

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

      it("builds a layout whose keys are ASCII and segments cover the whole string", () => {
        const layout = buildChineseLayout(entry.cells.map((c) => ({ hanzi: c.h, pinyin: c.p })));
        expect(layout.keys).toMatch(ASCII_PINYIN);
        expect(layout.segments[0]?.start).toBe(0);
        expect(layout.segments.at(-1)?.end).toBe(layout.keys.length);
        expect(layout.segments.length).toBe(entry.cells.length);
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
});
