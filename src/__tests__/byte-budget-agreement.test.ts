import { describe, expect, test } from "bun:test";
import { action, type Element, jsx, primitive, render, type WidgetProps } from "@arnilo/liveframe/sdk";
import { compileValidator } from "../index.ts";
import { utf8Length } from "../internal.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };

const validator = compileValidator({ catalog: catalogDocument, capabilities, manifest });
const options = { validator, surfaceId: "home", revision: 1 };
const inputs: WidgetProps = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: {
    filter: "all",
    selected: "decision-8812",
    cursors: { decisions: "start", tasks: "start", alerts: "start" },
    escalating: "",
    reason: "",
  },
  data: {},
  context: { size: "small" },
};

const Stack = primitive<{ readonly children?: unknown; readonly label?: string; readonly gap?: string }>("stack");
const Text = primitive<{ readonly text: string }>("text");
const Button = primitive<{ readonly label: string; readonly variant?: string; readonly onPress?: unknown }>("button");

/** mulberry32: a fixed seed keeps every run on the same 1,000 trees. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every JSON string class whose byte count differs: plain, escaped, control, 2-, 3- and 4-byte UTF-8, lone surrogates.
const pieces = [
  "a",
  "Z",
  " ",
  '"',
  "\\",
  "\n",
  "\t",
  "\u0001",
  "\u007f",
  "é",
  "世",
  "✓",
  "😀",
  "\ud800",
  "\udfff",
  "/",
  "~",
];

// render() throws a URIError on a key holding a lone surrogate (encodeSegment), so keys draw from well-formed pieces.
const keyPieces = pieces.filter((piece) => !/^[\ud800-\udfff]$/.test(piece));

function text(next: () => number, maximum: number, from: readonly string[] = pieces): string {
  let out = "";
  const length = Math.floor(next() * maximum);
  for (let i = 0; i < length; i++) out += from[Math.floor(next() * from.length)];
  return out;
}

function element(next: () => number, depth: number, key: string): Element {
  const pick = next();
  if (depth < 4 && pick < 0.35) {
    const children: Element[] = [];
    const count = Math.floor(next() * 4);
    for (let i = 0; i < count; i++) children.push(element(next, depth + 1, `${i}${text(next, 4, keyPieces)}`));
    const props: Record<string, unknown> = { children };
    if (next() < 0.5) props.label = text(next, 12);
    if (next() < 0.5) props.gap = "space.2";
    return jsx(Stack, props, key) as Element;
  }
  if (pick < 0.65) return jsx(Text, { text: text(next, 16) }, key) as Element;
  const props: Record<string, unknown> = { label: text(next, 12) };
  if (next() < 0.5) props.variant = ["default", "primary", "danger", "ghost"][Math.floor(next() * 4)];
  if (next() < 0.5) props.onPress = action("tasks.claim", { id: `t${Math.floor(next() * 1e6)}` });
  return jsx(Button, props, key) as Element;
}

describe("byte budget agreement", () => {
  test("render_and_validator_count_the_same_bytes", () => {
    const next = random(0x025003);
    for (let n = 0; n < 1000; n++) {
      const root = element(next, 1, "root");
      const widget = () => root;
      const result = render(widget, inputs, options);
      if (!result.ok) throw new Error(`tree ${n}: ${JSON.stringify(result.errors)}`);
      // Spec §10: the budget is the UTF-8 length of the tree's JSON.stringify output.
      const bytes = utf8Length(JSON.stringify(result.value));
      // Each owner accepts exactly `bytes` and rejects one less, so each one's count is exactly `bytes`.
      expect(render(widget, inputs, { ...options, limits: { bytes } }).ok).toBe(true);
      const over = render(widget, inputs, { ...options, limits: { bytes: bytes - 1 } });
      expect(over.ok ? [] : over.errors.map((error) => error.kind)).toContain("limit-exceeded");
      expect(validator.validateTree(result.value, { limits: { bytes } }).ok).toBe(true);
      const tight = validator.validateTree(result.value, { limits: { bytes: bytes - 1 } });
      expect(tight.ok ? [] : tight.errors.map((error) => error.kind)).toContain("limit-exceeded");
    }
  });
});
