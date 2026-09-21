import { describe, expect, it, vi } from "vitest";
import { makePassage } from "../corpus";
import { createDefaultProfile } from "./profile";
import { Session } from "./session";

/** Types the session's current passage end to end, one char per `interval` ms. */
function completeRun(session: Session, startMs = 1000, interval = 100): void {
  const text = session.snapshot().typing.expected;
  let t = startMs;
  for (const ch of text) {
    session.input(ch, t);
    t += interval;
  }
}

describe("Session", () => {
  it("auto-starts: a fresh default (benchmark) session has live text and no plan", () => {
    const session = new Session(createDefaultProfile());
    const snap = session.snapshot();
    expect(snap.mode).toBe("benchmark");
    expect(snap.plan).toBeNull();
    expect(snap.typing.expected.length).toBeGreaterThan(0);
    expect(snap.typing.completed).toBe(false);
  });

  it("adaptive mode produces a 6-letter plan", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    const session = new Session(profile);
    expect(session.snapshot().plan?.included).toHaveLength(6);
  });

  it("zh adaptive mode builds a syllable plan and uses the injected zh adaptive source", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    profile.settings.language = "zh";
    profile.settings.adaptive.minAlphabetSize = 2;
    const zhAdaptiveSource = vi.fn(({ included }) =>
      makePassage("zh-adaptive", [...included].join(""), [
        { start: 0, end: 3, display: "知", hint: "zhi" },
      ]),
    );
    const session = new Session(profile, {
      zhSyllableInventory: ["zhi", "shi", "bu"],
      zhAdaptiveSource,
      adaptiveSource: () => makePassage("english-adaptive", "eeee"),
    });

    const snap = session.snapshot();
    expect(snap.mode).toBe("adaptive");
    expect(snap.plan).toBeNull();
    expect(snap.zhPlan?.included).toEqual(["zhi", "shi"]);
    expect(snap.typing.expected).toBe("zhishi");
    expect(zhAdaptiveSource).toHaveBeenCalledWith(
      expect.objectContaining({ included: ["zhi", "shi"], focus: "zhi" }),
      profile.settings.wordCount,
      { passageLength: profile.settings.passageLength },
    );
  });

  it("records a RunResult into the profile when a run completes", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    const session = new Session(profile, {
      now: () => 999,
      adaptiveSource: (filter) => makePassage("drill", [...filter.allowed].join(" ")),
    });
    completeRun(session);
    expect(profile.results).toHaveLength(1);
    const [result] = profile.results;
    expect(result).toMatchObject({ index: 0, mode: "adaptive", timestamp: 999 });
    expect(result?.metrics.accuracy).toBe(100);
    expect(result?.histogram.size).toBeGreaterThan(0);
  });

  it("fires onResult exactly once per completed run", () => {
    const onResult = vi.fn();
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    const session = new Session(profile, {
      onResult,
      adaptiveSource: (filter) => makePassage("drill", [...filter.allowed].join(" ")),
    });
    completeRun(session);
    // Extra input after completion must not record again.
    session.input("x", 99999);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("closes the adaptive loop: a completed run reshapes the next lesson plan", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    const session = new Session(profile, {
      // Drill text uses only the unlocked letters, repeated for solid samples.
      adaptiveSource: (filter) =>
        makePassage("drill", `${[...filter.allowed].join(" ")} `.repeat(4)),
    });
    expect(session.snapshot().plan?.included).toHaveLength(6);

    // Type it fast and clean (100 ms/char ~ 120 WPM, well above the 50 WPM target).
    completeRun(session);
    expect(profile.results).toHaveLength(1);

    session.start(); // rebuild the plan from the now-non-empty history
    const secondPlan = session.snapshot().plan;
    expect(secondPlan?.included.length).toBeGreaterThan(6);
  });

  it("restart sources fresh text and clears the last result", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "adaptive";
    const session = new Session(profile, {
      adaptiveSource: (filter) => makePassage("drill", [...filter.allowed].join(" ")),
    });
    completeRun(session);
    expect(session.snapshot().lastResult).not.toBeNull();
    session.restart();
    const snap = session.snapshot();
    expect(snap.lastResult).toBeNull();
    expect(snap.typing.pos).toBe(0);
  });

  it("backspace delegates to the typing engine", () => {
    const session = new Session(createDefaultProfile());
    const ch = session.snapshot().typing.expected[0]!;
    session.input(ch, 1000);
    expect(session.snapshot().typing.pos).toBe(1);
    session.backspace();
    expect(session.snapshot().typing.pos).toBe(0);
  });

  it("benchmark runs also feed the profile history", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "benchmark";
    const session = new Session(profile, {
      benchmarkSource: () => makePassage("bench", "the cat sat"),
    });
    completeRun(session);
    expect(profile.results).toHaveLength(1);
    expect(profile.results[0]?.mode).toBe("benchmark");
    expect(profile.results[0]?.histogram.size).toBeGreaterThan(0);
  });

  it("has no confusion tally for a Latin (en) run", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "benchmark";
    const session = new Session(profile, {
      benchmarkSource: () => makePassage("bench", "the cat sat"),
    });
    completeRun(session);
    expect(profile.results[0]?.confusions).toBeUndefined();
  });

  it("tallies a 前后鼻音 confusion on a Chinese run", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "benchmark";
    profile.settings.language = "zh";
    profile.settings.pinyinScheme = "ziranma";
    // 民 min = "mn", 四 si = "si" in 自然码.
    const passage = makePassage("zh-test", "mnsi", [
      { start: 0, end: 2, display: "民", hint: "mn", note: "min" },
      { start: 2, end: 4, display: "四", hint: "si", note: "si" },
    ]);
    const session = new Session(profile, { now: () => 1, benchmarkSource: () => passage });
    // Type 民 as "my" (= 明 ming) — a 前后鼻音 slip — then 四 correctly.
    let t = 1000;
    for (const ch of ["m", "y", "s", "i"]) {
      session.input(ch, t);
      t += 100;
    }
    const result = profile.results[0];
    expect(result?.confusions?.counts).toEqual({ nasal: 1, retroflex: 0, nl: 0 });
    expect(result?.confusions?.hits).toContainEqual({ expected: "min", kind: "nasal" });
  });

  it("records per-syllable timings for a segmented Chinese run", () => {
    const profile = createDefaultProfile();
    profile.settings.mode = "benchmark";
    profile.settings.language = "zh";
    const passage = makePassage("zh-test", "zhongguo", [
      { start: 0, end: 5, display: "中", hint: "zhong" },
      { start: 5, end: 8, display: "国", hint: "guo" },
    ]);
    const session = new Session(profile, { now: () => 1, benchmarkSource: () => passage });
    completeRun(session, 1000, 100);

    expect(profile.results[0]?.syllableTimes).toEqual({ zhong: 100, guo: 100 });
  });
});
