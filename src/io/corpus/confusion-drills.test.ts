import { describe, expect, it } from "vitest";
import {
  type ConfusionKind,
  classifyConfusion,
  isValidSyllable,
  type PinyinScheme,
  syllableToKeys,
} from "../../engine/pinyin";
import { mulberry32 } from "../../engine/rng";
import { ZH_ENTRIES } from "./chinese";
import { createConfusionDrillSource, DRILL_FAMILIES } from "./confusion-drills";

const ASCII_PINYIN = /^[a-z]+$/;
const SINGLE_BMP = /^[一-鿿]$/;
const SCHEMES: readonly PinyinScheme[] = ["full", "xiaohe", "ziranma"];

describe("confusion drills data contract", () => {
  for (const family of DRILL_FAMILIES) {
    describe(family, () => {
      for (const scheme of SCHEMES) {
        it(`builds an ASCII passage whose segments cover the keys (${scheme})`, () => {
          const passage = createConfusionDrillSource(() => scheme).pick(40, mulberry32(1), family);
          expect(passage.id).toBe(`zh-confusion-${family}`);
          expect(passage.text).toMatch(ASCII_PINYIN);
          const segments = passage.segments ?? [];
          expect(segments.length).toBeGreaterThan(0);
          expect(segments[0]?.start).toBe(0);
          expect(segments.at(-1)?.end).toBe(passage.text.length);
          for (const seg of segments) {
            expect(seg.display, "hanzi").toMatch(SINGLE_BMP);
            expect(seg.note ?? seg.hint, "pinyin").toMatch(ASCII_PINYIN);
          }
        });
      }
    });
  }
});

describe("confusion drills are self-consistent with the classifier", () => {
  // For every drilled character, the *other* member of its contrast must be a
  // variant the classifier attributes back to this family — otherwise the drill
  // trains a slip the passive detector would miss. Checked in double pinyin,
  // where every contrast is an equal-length key swap.
  for (const scheme of ["xiaohe", "ziranma"] as const) {
    it(`each drilled syllable's contrast is classified to its family (${scheme})`, () => {
      const source = createConfusionDrillSource(() => scheme);
      for (const family of DRILL_FAMILIES) {
        const passage = source.pick(40, mulberry32(1), family);
        const segments = passage.segments ?? [];
        // Pair members alternate: [a0,b0,a1,b1,...]. a typed as b (and vice
        // versa) is the family contrast.
        for (let i = 0; i + 1 < segments.length; i += 2) {
          const a = segments[i];
          const b = segments[i + 1];
          if (a?.note === undefined || b?.note === undefined) continue;
          const aKeys = syllableToKeys(a.note, scheme);
          const bKeys = syllableToKeys(b.note, scheme);
          expect(classifyConfusion(a.note, bKeys, scheme), `${a.note}→${b.note}`).toBe(
            family as ConfusionKind,
          );
          expect(classifyConfusion(b.note, aKeys, scheme), `${b.note}→${a.note}`).toBe(
            family as ConfusionKind,
          );
        }
      }
    });
  }
});

describe("syllable inventory covers the shipped corpus", () => {
  // Guards the confusion syllable set against false *negatives*: if a real
  // corpus/drill syllable were missing from the inventory, a legitimate
  // contrast built from it would be silently filtered out.
  it("recognises every pinyin in the drills and zh.json as a real syllable", () => {
    const source = createConfusionDrillSource();
    for (const family of DRILL_FAMILIES) {
      for (const seg of source.pick(40, mulberry32(1), family).segments ?? []) {
        const pinyin = seg.note ?? seg.hint;
        expect(isValidSyllable(pinyin ?? ""), `drill ${family}: "${pinyin}"`).toBe(true);
      }
    }
    for (const entry of ZH_ENTRIES) {
      for (const cell of entry.cells) {
        expect(isValidSyllable(cell.p), `${entry.id}: "${cell.p}" (${cell.h})`).toBe(true);
      }
    }
  });
});

describe("createConfusionDrillSource", () => {
  it("picks some drill family when none is pinned", () => {
    const passage = createConfusionDrillSource().pick(40, mulberry32(7));
    expect(passage.id.startsWith("zh-confusion-")).toBe(true);
  });

  it("is deterministic for a fixed seed", () => {
    const a = createConfusionDrillSource().pick(40, mulberry32(42));
    const b = createConfusionDrillSource().pick(40, mulberry32(42));
    expect(a.id).toBe(b.id);
  });
});
