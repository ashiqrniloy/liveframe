import { canonicalJson, packageHash, sha256, utf8 } from "../src/pack/hash.ts";
import { metric } from "./metrics.ts";

/** Median wall time in ms of `run` over `rounds` calls, after a warm-up. */
function median(run: () => unknown, rounds: number): number {
  for (let i = 0; i < 3; i++) run();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[Math.floor(rounds / 2)] as number;
}

const mib = new Uint8Array(1 << 20);
for (let i = 0; i < mib.length; i++) mib[i] = (i * 31 + 7) & 255;
const shaMs = median(() => sha256(mib), 15);
metric("sha256.msPerMiB", shaMs);
console.log(`sha256: ${shaMs.toFixed(3)} ms per MiB`);

const text = "a".repeat(1 << 20);
const utfMs = median(() => utf8(text), 15);
metric("utf8.asciiMsPerMiB", utfMs);
console.log(`utf8 ascii: ${utfMs.toFixed(3)} ms per MiB`);

const mixed = "aé€😀".repeat(1 << 16);
const mixedMs = median(() => utf8(mixed), 15);
metric("utf8.mixedMsPerMiBChars", mixedMs);
console.log(`utf8 mixed: ${mixedMs.toFixed(3)} ms for ${mixed.length} UTF-16 units`);

// A package-shaped value: nested objects with sorted-key work, strings, numbers, arrays.
const rows = Array.from({ length: 2000 }, (_, i) => ({ id: `row-${i}`, label: `Label ${i}`, n: i, tags: ["x", "y"] }));
const value = { format: "liveframe-package/1", manifest: { rows }, code: "a".repeat(256 * 1024), scenarios: [] };
const canonicalMs = median(() => canonicalJson(value), 15);
metric("canonicalJson.ms", canonicalMs);
console.log(`canonicalJson: ${canonicalMs.toFixed(3)} ms`);

const pkg = {
  format: "liveframe-package/1" as const,
  manifest: { rows } as never,
  code: "a".repeat(512 * 1024),
  scenarios: [],
};
const packageMs = median(() => packageHash(pkg), 15);
metric("packageHash.512KiB.ms", packageMs);
console.log(`packageHash (512 KiB code + rows): ${packageMs.toFixed(3)} ms`);
