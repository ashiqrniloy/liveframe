/**
 * Chromium trace helper: sums main-thread Layout and Paint event durations for the
 * window between two `performance.mark()` calls, so a measurement can split React
 * work from layout plus paint.
 *
 * A tracing session must already be active while the measured work runs; a session
 * started after the page has painted captured no layout or paint events.
 */
import type { BrowserContext } from "playwright";

type CDPSession = Awaited<ReturnType<BrowserContext["newCDPSession"]>>;
type TraceEvent = { readonly name?: string; readonly cat?: string; readonly ts?: number; readonly dur?: number };

export const TRACE_MARKS = { from: "lf-recorded-start", to: "lf-recorded-end" } as const;

const RENDER_EVENTS = new Set(["Layout", "Paint"]);

export async function startRenderTrace(session: CDPSession): Promise<void> {
  await session.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing",
    transferMode: "ReturnAsStream",
  });
}

export async function stopRenderTrace(
  session: CDPSession,
  window: { from: string; to: string },
): Promise<{ layoutPaintMs: number; events: number }> {
  const complete = new Promise<string>((resolve) => {
    session.once("Tracing.tracingComplete", (event: { stream?: string }) => resolve(event.stream ?? ""));
  });
  await session.send("Tracing.end");
  const handle = await complete;
  let text = "";
  for (;;) {
    const chunk = await session.send("IO.read", { handle });
    text += chunk.data;
    if (chunk.eof) break;
  }
  await session.send("IO.close", { handle });
  const events = (JSON.parse(text) as { traceEvents?: TraceEvent[] }).traceEvents ?? [];
  const mark = (name: string): number => {
    const found = events.find((event) => event.cat === "blink.user_timing" && event.name === name);
    if (found?.ts === undefined) throw new Error(`Missing trace mark ${name}`);
    return found.ts;
  };
  const from = mark(window.from);
  const to = mark(window.to);
  let layoutPaintUs = 0;
  let counted = 0;
  for (const event of events) {
    if (event.name && RENDER_EVENTS.has(event.name) && typeof event.ts === "number" && typeof event.dur === "number") {
      if (event.ts >= from && event.ts <= to) {
        layoutPaintUs += event.dur;
        counted++;
      }
    }
  }
  return { layoutPaintMs: layoutPaintUs / 1000, events: counted };
}
