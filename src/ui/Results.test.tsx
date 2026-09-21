// @vitest-environment jsdom
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LessonKey, LessonPlan } from "../engine/adaptive";
import type { RunResult } from "../engine/session";
import { Results } from "./Results";

function key(letter: string, confidence: number | null): LessonKey {
  return {
    letter,
    included: true,
    forced: false,
    focused: false,
    confidence,
    bestConfidence: confidence,
  };
}

function planFrom(keys: LessonKey[]): LessonPlan {
  return { included: keys.map((k) => k.letter), focus: null, keys, weakBigrams: [] };
}

const sampleResult: RunResult = {
  index: 0,
  mode: "adaptive",
  timestamp: Date.now(),
  passageId: "p",
  text: "the cat",
  metrics: {
    netWpm: 75,
    rawWpm: 80,
    accuracy: 95,
    consistency: 88,
    wpmStdDev: 0,
    wpmSeries: [],
    correctChars: 30,
    incorrectChars: 1,
    durationMs: 30000,
  },
  histogram: new Map(),
};

describe("Results", () => {
  let dispose: () => void = () => {};
  afterEach(() => {
    dispose();
    dispose = () => {};
    document.body.innerHTML = "";
  });

  function mount(
    plan: LessonPlan | null,
    callbacks: { onNext?: () => void; onSettings?: () => void; result?: RunResult } = {},
  ): HTMLElement {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <Results
          result={callbacks.result ?? sampleResult}
          plan={plan}
          entry={null}
          unlocked={[]}
          onNext={callbacks.onNext ?? (() => {})}
          onSettings={callbacks.onSettings ?? (() => {})}
        />
      ),
      host,
    );
    return host;
  }

  it("renders the four headline stats", () => {
    const host = mount(null);
    const stats = host.querySelectorAll(".stat__value");
    expect(stats).toHaveLength(4);
    expect(host.querySelector(".stat--big .stat__value")?.textContent).toBe("75");
    expect(host.textContent).toContain("95%"); // accuracy
    expect(host.textContent).toContain("88%"); // consistency
  });

  it("lists weak keys sorted slowest first, capped at 6", () => {
    const plan = planFrom([
      key("a", 0.2),
      key("b", 0.4),
      key("c", 0.6),
      key("d", 0.8),
      key("e", 0.5),
      key("f", 0.3),
      key("g", 0.1), // weakest
      key("h", 1.2), // mastered — excluded
    ]);
    const host = mount(plan);
    const weakKeys = Array.from(host.querySelectorAll(".weak-key")).map((el) => el.textContent);
    expect(weakKeys).toHaveLength(6);
    expect(weakKeys[0]).toBe("g"); // lowest confidence first
    expect(weakKeys).not.toContain("h"); // mastered excluded
  });

  it("shows the celebratory fallback when every active key is at target", () => {
    const plan = planFrom([key("a", 1.5), key("b", 1.2)]);
    const host = mount(plan);
    expect(host.querySelector(".weak-keys")).toBeNull();
    expect(host.querySelector(".results__note")?.textContent).toMatch(/at target/);
  });

  it("hides the weak-keys section entirely in benchmark mode (no plan)", () => {
    const host = mount(null);
    expect(host.querySelector(".weak-keys")).toBeNull();
    expect(host.querySelector(".results__note")).toBeNull();
  });

  it("shows a confusion breakdown (Chinese runs) with family label and count", () => {
    const result: RunResult = {
      ...sampleResult,
      confusions: {
        counts: { nasal: 2, retroflex: 1, nl: 0 },
        hits: [
          { expected: "min", kind: "nasal" },
          { expected: "ming", kind: "nasal" },
          { expected: "si", kind: "retroflex" },
        ],
      },
    };
    const host = mount(null, { result });
    const rows = Array.from(host.querySelectorAll(".confusion")).map((el) => el.textContent ?? "");
    // Families with a hit are shown (nl == 0 is omitted); sorted most-confused first.
    expect(rows.some((t) => t.includes("前后鼻音") && t.includes("2"))).toBe(true);
    expect(rows.some((t) => t.includes("平翘舌") && t.includes("1"))).toBe(true);
    expect(rows.some((t) => t.includes("边鼻音"))).toBe(false);
  });

  it("shows no confusion breakdown for a Latin run", () => {
    const host = mount(null);
    expect(host.querySelector(".confusions")).toBeNull();
  });

  it("fires onNext and onSettings from the action buttons", () => {
    const onNext = vi.fn();
    const onSettings = vi.fn();
    const host = mount(null, { onNext, onSettings });
    const buttons = host.querySelectorAll<HTMLButtonElement>(".actions .btn");
    buttons[0]?.click();
    buttons[1]?.click();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
