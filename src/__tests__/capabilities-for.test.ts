import { expect, test } from "bun:test";
import { capabilitiesFor, type Capabilities, type Manifest, obj, validateCapabilities } from "../index.ts";
import manifestDocument from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const action = { description: "Action", args: obj({}), confirm: true, meta: { label: "host" } };
const source = { description: "Source", params: obj({}), result: obj({}), meta: { label: "host" } };
const capabilities: Capabilities = {
  format: "liveframe-capabilities/1",
  actions: { zebra: action, unused: action, alpha: action },
  sources: { zebra: source, unused: source, alpha: source },
};
const manifest: Manifest = {
  ...manifestDocument,
  format: "liveframe-manifest/1",
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  actions: ["alpha", "zebra"],
  sources: {
    first: { source: "alpha", params: {} },
    second: { source: "zebra", params: {} },
    repeated: { source: "alpha", params: {} },
  },
};

test("capabilities_for_is_deterministic", () => {
  const before = structuredClone({ capabilities, manifest });
  const result = capabilitiesFor(capabilities, manifest);
  expect(result).toEqual(capabilitiesFor(capabilities, manifest));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(Object.keys(result.value.actions)).toEqual(["zebra", "alpha"]);
  expect(Object.keys(result.value.sources)).toEqual(["zebra", "alpha"]);
  expect(result.value).toEqual({
    format: capabilities.format,
    actions: { zebra: action, alpha: action },
    sources: { zebra: source, alpha: source },
  });
  expect(validateCapabilities(result.value).ok).toBe(true);
  expect({ capabilities, manifest }).toEqual(before);
  expect(result.value.actions).not.toBe(capabilities.actions);
  expect(result.value.sources).not.toBe(capabilities.sources);
  expect(capabilitiesFor(capabilities, { ...manifest, actions: [], sources: {} })).toEqual({
    ok: true,
    value: { format: capabilities.format, actions: {}, sources: {} },
  });
});

test("capabilities_for_rejects_unknown_name", () => {
  expect(
    capabilitiesFor(capabilities, {
      ...manifest,
      actions: ["missing", "toString"],
      sources: { "alias/~": { source: "constructor", params: {} } },
    }),
  ).toEqual({
    ok: false,
    errors: [
      { kind: "unknown-name", pointer: "/actions/0", message: "Undeclared action" },
      { kind: "unknown-name", pointer: "/actions/1", message: "Undeclared action" },
      { kind: "unknown-name", pointer: "/sources/alias~1~0/source", message: "Undeclared source" },
    ],
  });
  const result = capabilitiesFor(capabilities, { ...manifest, actions: Array(30).fill("missing") });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toHaveLength(20);
});
