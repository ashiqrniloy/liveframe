/**
 * The statistics `bench/ab.ts` decides with. Pure, so they are tested on their own
 * (`src/__tests__/bench-stats.test.ts`).
 */

export type Interval = { readonly median: number; readonly low: number; readonly high: number };
export type Verdict = "pass" | "fail" | "inconclusive";

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** A small seeded generator, so the same samples always give the same interval. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The median of `values` with a percentile-bootstrap interval of it (95% by default). */
export function bootstrap(values: readonly number[], resamples = 4000, confidence = 0.95, seed = 1): Interval {
  if (values.length === 0) throw new Error("bootstrap needs at least one value");
  const random = mulberry32(seed);
  const medians = new Float64Array(resamples);
  const draw = new Array<number>(values.length);
  for (let r = 0; r < resamples; r++) {
    for (let i = 0; i < values.length; i++) draw[i] = values[Math.floor(random() * values.length)] as number;
    medians[r] = median(draw);
  }
  medians.sort();
  const tail = (1 - confidence) / 2;
  const at = (q: number) => medians[Math.min(resamples - 1, Math.max(0, Math.floor(q * resamples)))] as number;
  return { median: median(values), low: at(tail), high: at(1 - tail) };
}

/** head/base for each paired run. */
export function pairedRatios(base: readonly number[], head: readonly number[]): number[] {
  if (base.length !== head.length) throw new Error("paired samples differ in length");
  return base.map((b, i) => (head[i] as number) / b);
}

/** `pass` when the whole interval is at or below `threshold`, `fail` when it is wholly above, else `inconclusive`. */
export function verdict(interval: Interval, threshold: number): Verdict {
  if (interval.high <= threshold) return "pass";
  if (interval.low > threshold) return "fail";
  return "inconclusive";
}

/** An A/A control is usable unless its whole interval lies outside 1 ± (threshold − 1). */
export function controlUsable(interval: Interval, threshold: number): boolean {
  const slack = threshold - 1;
  return !(interval.low > 1 + slack || interval.high < 1 - slack);
}
