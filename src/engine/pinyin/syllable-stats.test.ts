import { describe, expect, it } from "vitest";
import type { InputSegment } from "../corpus";
import type { Step } from "../typing";
import { syllableTimesFromRun } from "./syllable-stats";

const segments: readonly InputSegment[] = [
  { start: 0, end: 5, display: "中", hint: "zhong" },
  { start: 5, end: 8, display: "国", hint: "guo" },
  { start: 8, end: 13, display: "重", hint: "zhong" },
];

function step(position: number, expected: string, timeToType: number, typo = false): Step {
  return { position, expected, typed: expected, timeStamp: position * 100, timeToType, typo };
}

describe("syllableTimesFromRun", () => {
  it("averages clean plausible per-character timings by full pinyin syllable", () => {
    const steps: readonly Step[] = [
      step(0, "z", 100),
      step(1, "h", 120),
      step(2, "o", 130),
      step(3, "n", 140),
      step(4, "g", 150),
      step(5, "g", 200),
      step(6, "u", 20), // implausibly fast, excluded from timing
      step(7, "o", 300),
      step(8, "z", 100),
      step(9, "h", 100, true), // typo, excluded from timing
      step(10, "o", 200),
      step(11, "n", 13_000), // implausibly slow, excluded from timing
      step(12, "g", 300),
    ];

    expect(syllableTimesFromRun(segments, steps)).toEqual({
      zhong: 155,
      guo: 250,
    });
  });

  it("ignores retry/backspace sequences that do not move to the next position", () => {
    const steps: readonly Step[] = [
      step(0, "z", 100),
      step(1, "h", 100),
      step(1, "h", 100), // stop-on-error retry, not adjacent from previous
      step(2, "o", 100),
      step(1, "h", 100), // backspace jump
      step(2, "o", 100),
      step(3, "n", 100),
      step(4, "g", 100),
    ];

    expect(syllableTimesFromRun(segments.slice(0, 1), steps)).toEqual({ zhong: 100 });
  });
});
