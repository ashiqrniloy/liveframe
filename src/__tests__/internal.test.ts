import { expect, test } from "bun:test";
import { at, errorMessage, isThenable, pointerSegment, queue, utf8Length } from "../internal.ts";

test("pointer_segment_escapes_tilde_before_slash", () => {
  expect(pointerSegment("a/~b")).toBe("a~1~0b");
  expect(pointerSegment("~1")).toBe("~01");
  expect(pointerSegment("plain")).toBe("plain");
  expect(pointerSegment(3)).toBe("3");
  expect(at("/files", "a/b.ts")).toBe("/files/a~1b.ts");
});

test("error_message_reads_errors_and_stringifies_the_rest", () => {
  expect(errorMessage(new TypeError("bad"))).toBe("bad");
  expect(errorMessage("text")).toBe("text");
  expect(errorMessage(42)).toBe("42");
});

test("is_thenable_accepts_objects_and_functions_with_a_callable_then", () => {
  // A callable `then` inherited from Promise.prototype, on a plain object and on a function.
  const thenables = [
    Promise.resolve(),
    Object.create(Promise.prototype),
    Object.setPrototypeOf(() => {}, Promise.prototype),
  ];
  expect(thenables.every(isThenable)).toBe(true);
  expect([null, undefined, 1, "then", {}, () => {}].some(isThenable)).toBe(false);
});

test("queue_runs_serially_and_survives_a_rejection", async () => {
  const serial = queue();
  const order: string[] = [];
  const step = (name: string, ms: number, fail = false) =>
    serial(async () => {
      order.push(`start ${name}`);
      await Bun.sleep(ms);
      order.push(`end ${name}`);
      if (fail) throw new Error(name);
      return name;
    });
  const results = await Promise.allSettled([step("a", 10), step("b", 1, true), step("c", 1)]);
  expect(order).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  expect(results[2]).toEqual({ status: "fulfilled", value: "c" });
});

test("utf8_length_matches_text_encoder", () => {
  const units = [0x41, 0x7f, 0x80, 0x7ff, 0x800, 0xffff, 0xd83d, 0xde00, 0xd800, 0xdfff, 0x0];
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed;
  };
  const encoder = new TextEncoder();
  for (let n = 0; n < 2000; n++) {
    let text = "";
    for (let i = next() % 24; i > 0; i--)
      text += String.fromCharCode(next() % 3 === 0 ? (units[next() % units.length] ?? 0) : next() % 0x10000);
    expect(utf8Length(text)).toBe(encoder.encode(text).byteLength);
  }
  expect(utf8Length("😀")).toBe(4);
  expect(utf8Length("\ud800")).toBe(3);
  expect(utf8Length("\ude00\ud83d")).toBe(6);
});

test("utf8_length_stops_past_the_maximum", () => {
  expect(utf8Length("a".repeat(100), 10)).toBeGreaterThan(10);
  expect(utf8Length("a".repeat(100), 10)).toBeLessThan(100);
  expect(utf8Length("abc", 3)).toBe(3);
});
