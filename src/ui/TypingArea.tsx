import type { JSX } from "solid-js";
import { createMemo, Index, Show } from "solid-js";
import type { InputSegment } from "../engine/corpus";
import type { TypingSnapshot } from "../engine/typing";

export interface TypingAreaProps {
  typing: TypingSnapshot;
  /**
   * Show faint glyphs in place of invisible chars (space → ·, tab → →,
   * newline → ↵). Controlled by the Appearance → "Show whitespace
   * markers" toggle. When false the markers are suppressed via a
   * single CSS rule (`.typing-area--no-ws .char::before { content: none }`),
   * so toggling is just a class flip — no re-render of the char grid.
   */
  showWhitespace: boolean;
  /**
   * Chinese passages only: one display segment per hanzi over `typing.expected`
   * (the pinyin key string). When present, the area renders hanzi blocks with
   * per-letter pinyin annotation above; when absent, the Latin per-character
   * grid renders. Latin passages leave this null/undefined.
   */
  segments?: readonly InputSegment[] | null;
  /** Active typing time (ms) — used to derive the Chinese live CPM readout. */
  elapsedMs?: number;
}

/**
 * Renders the text to type. Two layouts share the same status model:
 *  - Latin (default): one span per character.
 *  - Chinese (`segments` present): one hanzi block per segment, its pinyin keys
 *    annotated above and coloured per-letter by the same correct/incorrect/
 *    current status the engine already tracks. The user still types the pinyin;
 *    the hanzi is display-only.
 */
export function TypingArea(props: TypingAreaProps): JSX.Element {
  return (
    <Show
      when={props.segments && props.segments.length > 0 ? props.segments : null}
      fallback={<LatinArea typing={props.typing} showWhitespace={props.showWhitespace} />}
    >
      {(segments) => (
        <ChineseArea typing={props.typing} segments={segments()} elapsedMs={props.elapsedMs ?? 0} />
      )}
    </Show>
  );
}

/**
 * The original Latin render: one span per character. The span list is
 * length-stable for a run, so `<Index>` keeps the DOM nodes and only the
 * `classList` accessors re-run when the snapshot changes.
 */
function LatinArea(props: { typing: TypingSnapshot; showWhitespace: boolean }): JSX.Element {
  const expected = createMemo(() => props.typing.expected);
  const chars = createMemo(() => [...expected()]);
  return (
    <section
      class="typing-area"
      classList={{ "typing-area--no-ws": !props.showWhitespace }}
      aria-label="typing area"
    >
      <Index each={chars()}>
        {(char, index) => (
          <span
            classList={{
              char: true,
              "char--correct": props.typing.statuses[index] === "correct",
              "char--incorrect": props.typing.statuses[index] === "incorrect",
              "char--current": index === props.typing.pos,
              "char--space": char() === " ",
              "char--tab": char() === "\t",
              "char--newline": char() === "\n",
            }}
          >
            {char()}
          </span>
        )}
      </Index>
    </section>
  );
}

interface CjkCell extends InputSegment {
  /** The pinyin key characters for this hanzi, split for per-letter colouring. */
  chars: string[];
}

/**
 * Chinese render. `cells` is memoised on the expected string + segments so a
 * per-keystroke snapshot tick doesn't rebuild the array — only the per-position
 * class accessors re-run, keeping the hot loop cheap.
 */
function ChineseArea(props: {
  typing: TypingSnapshot;
  segments: readonly InputSegment[];
  elapsedMs: number;
}): JSX.Element {
  const cells = createMemo<CjkCell[]>(() => {
    const expected = props.typing.expected;
    return props.segments.map((seg) => ({
      ...seg,
      chars: [...expected.slice(seg.start, seg.end)],
    }));
  });
  // Count of fully-typed hanzi — the cursor has passed each of their key ranges.
  const doneCells = createMemo(() => {
    const pos = props.typing.pos;
    let n = 0;
    for (const seg of props.segments) {
      if (pos >= seg.end) n++;
      else break;
    }
    return n;
  });
  const total = createMemo(() => props.segments.length);
  // Characters-per-minute — the meaningful Chinese metric (WPM is key-based and
  // not comparable to English). Derived, so the engine's metric model is
  // untouched.
  const cpm = createMemo(() => {
    const minutes = props.elapsedMs / 60_000;
    return minutes > 0 ? Math.round(doneCells() / minutes) : 0;
  });

  return (
    <section class="typing-area typing-area--cjk" aria-label="typing area">
      <div class="cjk-status">
        <span class="cjk-status__progress">
          第 {Math.min(doneCells() + 1, total())} / {total()} 字
        </span>
        <Show when={props.elapsedMs > 0}>
          <span class="cjk-status__cpm">{cpm()} 字/分</span>
        </Show>
      </div>
      <div class="cjk-cells">
        <Index each={cells()}>
          {(cell) => (
            <div
              classList={{
                "cjk-cell": true,
                "cjk-cell--active":
                  props.typing.pos >= cell().start && props.typing.pos < cell().end,
                "cjk-cell--done": props.typing.pos >= cell().end,
              }}
            >
              <div class="cjk-cell__pinyin">
                <Index each={cell().chars}>
                  {(ch, k) => (
                    <span
                      classList={{
                        "cjk-py": true,
                        "cjk-py--correct": props.typing.statuses[cell().start + k] === "correct",
                        "cjk-py--incorrect":
                          props.typing.statuses[cell().start + k] === "incorrect",
                        "cjk-py--current": cell().start + k === props.typing.pos,
                      }}
                    >
                      {ch()}
                    </span>
                  )}
                </Index>
              </div>
              <div class="cjk-cell__hanzi">{cell().display}</div>
              <Show when={cell().note}>
                <div class="cjk-cell__note">{cell().note}</div>
              </Show>
            </div>
          )}
        </Index>
      </div>
    </section>
  );
}
