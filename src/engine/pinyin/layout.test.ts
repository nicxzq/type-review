import { describe, expect, it } from "vitest";
import { buildChineseLayout } from "./layout";
import type { PinyinCell } from "./types";

const ZHONG_GUO: PinyinCell[] = [
  { hanzi: "中", pinyin: "zhong" },
  { hanzi: "国", pinyin: "guo" },
];

describe("buildChineseLayout (full pinyin)", () => {
  it("concatenates pinyin into the flat key string", () => {
    expect(buildChineseLayout(ZHONG_GUO).keys).toBe("zhongguo");
  });

  it("emits one segment per hanzi with correct key ranges", () => {
    const { segments } = buildChineseLayout(ZHONG_GUO);
    expect(segments).toEqual([
      { start: 0, end: 5, display: "中", hint: "zhong" },
      { start: 5, end: 8, display: "国", hint: "guo" },
    ]);
  });

  it("keeps segment ranges contiguous, monotonic, and covering the whole key string", () => {
    const cells: PinyinCell[] = [
      { hanzi: "女", pinyin: "nv" },
      { hanzi: "略", pinyin: "lve" },
      { hanzi: "学", pinyin: "xue" },
    ];
    const { keys, segments } = buildChineseLayout(cells);
    expect(segments[0]?.start).toBe(0);
    expect(segments.at(-1)?.end).toBe(keys.length);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i]?.start).toBe(segments[i - 1]?.end);
    }
    // Every segment's slice equals its cell's pinyin.
    for (const seg of segments) {
      expect(keys.slice(seg.start, seg.end)).toBe(seg.hint);
    }
  });

  it("normalises pinyin to lowercase — hint is the keys the user types", () => {
    const { keys, segments } = buildChineseLayout([{ hanzi: "你", pinyin: "NI" }]);
    expect(keys).toBe("ni");
    expect(segments[0]?.hint).toBe("ni");
  });

  it("xiaohe scheme emits two-key codes with the full pinyin as note", () => {
    const { keys, segments } = buildChineseLayout(
      [
        { hanzi: "中", pinyin: "zhong" },
        { hanzi: "国", pinyin: "guo" },
      ],
      "xiaohe",
    );
    expect(keys).toBe("vsgo");
    expect(segments[0]).toEqual({ start: 0, end: 2, display: "中", hint: "vs", note: "zhong" });
    expect(segments[1]).toEqual({ start: 2, end: 4, display: "国", hint: "go", note: "guo" });
  });

  it("rejects an empty cell list", () => {
    expect(() => buildChineseLayout([])).toThrow(/at least one cell/);
  });

  it("rejects non-ASCII pinyin (tone marks / ü) so the cursor cannot desync", () => {
    expect(() => buildChineseLayout([{ hanzi: "女", pinyin: "nü" }])).toThrow(/ASCII/);
    expect(() => buildChineseLayout([{ hanzi: "中", pinyin: "zhōng" }])).toThrow(/ASCII/);
  });
});
