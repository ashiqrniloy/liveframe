import { expect, test } from "bun:test";
import { bootstrap, controlUsable, median, pairedRatios, verdict } from "../../bench/stats.ts";

test("bootstrap_interval_is_deterministic_and_brackets_the_median", () => {
  const ratios = [0.97, 1.01, 0.99, 1.04, 1.0, 0.98, 1.02];
  const first = bootstrap(ratios);
  expect(bootstrap(ratios)).toEqual(first);
  expect(first.median).toBe(median(ratios));
  expect(first.low).toBeLessThanOrEqual(first.median);
  expect(first.high).toBeGreaterThanOrEqual(first.median);
  expect(first.low).toBeGreaterThanOrEqual(Math.min(...ratios));
  expect(first.high).toBeLessThanOrEqual(Math.max(...ratios));
  // More spread gives a wider interval.
  const wide = bootstrap([0.7, 1.3, 0.8, 1.2, 1.0, 0.75, 1.25]);
  expect(wide.high - wide.low).toBeGreaterThan(first.high - first.low);
  expect(() => bootstrap([])).toThrow();
});

test("paired_ratios_divide_head_by_base_run_by_run", () => {
  expect(pairedRatios([2, 4], [3, 2])).toEqual([1.5, 0.5]);
  expect(() => pairedRatios([1], [1, 2])).toThrow();
});

test("verdict_passes_fails_and_withholds_by_the_interval", () => {
  expect(verdict({ median: 0.99, low: 0.97, high: 1.02 }, 1.02)).toBe("pass");
  expect(verdict({ median: 1.05, low: 1.03, high: 1.08 }, 1.02)).toBe("fail");
  expect(verdict({ median: 1.0, low: 0.95, high: 1.06 }, 1.02)).toBe("inconclusive");
  expect(verdict({ median: 1.03, low: 1.02, high: 1.04 }, 1.02)).toBe("inconclusive");
  expect(controlUsable({ median: 1.0, low: 0.9, high: 1.1 }, 1.02)).toBe(true);
  expect(controlUsable({ median: 1.05, low: 1.03, high: 1.07 }, 1.02)).toBe(false);
  expect(controlUsable({ median: 0.95, low: 0.93, high: 0.97 }, 1.02)).toBe(false);
});
