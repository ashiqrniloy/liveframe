import { expect, test } from "bun:test";
import {
  checkValue,
  type Infer,
  isLanguageSchema,
  obj,
  sourceOutcome,
  str,
  validateCapabilities,
} from "@arnilo/liveframe";
import { canonicalJson, outcomeScenarios, type Scenario } from "@arnilo/liveframe/pack";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaDocument } from "../formats/registry.ts";
import { packageOptions, value } from "./fixtures/widgets/drafts.ts";

const result = sourceOutcome(obj({ title: str({ minLength: 1, maxLength: 20 }) }));
const capabilities = value(
  validateCapabilities({
    ...packageOptions.capabilities,
    sources: { "queue.read": { description: "Queue", params: obj({}), result } },
  }),
);
const manifest = { sources: { queue: { source: "queue.read", params: {} } } };
const options = { source: "queue", manifest, capabilities };
const scenario: Scenario = {
  name: "full",
  params: {},
  context: {},
  state: {},
  data: { queue: { status: "ok", value: { title: "Ready" }, checkedAt: "today" }, other: [] },
};

test("source_outcome_is_language_schema", () => {
  expect(isLanguageSchema(result)).toBe(true);
  const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schemaDocument("capabilities"));
  expect(validate(capabilities)).toBe(true);
  const typed: Infer<typeof result> = { status: "ok", value: { title: "Ready" } };
  if (typed.status === "ok") {
    const title: string = typed.value.title;
    expect(title).toBe("Ready");
    // @ts-expect-error success has no reason
    typed.reason;
  }
  for (const status of Object.keys(result.mapping)) {
    const envelope = status === "ok" ? { status, value: { title: "Ready" } } : { status };
    expect(checkValue(result, envelope).ok).toBe(true);
    expect(checkValue(result, { ...envelope, reason: "😀".repeat(501) }).ok).toBe(false);
    expect(checkValue(result, { ...envelope, extra: true }).ok).toBe(false);
    if (status !== "ok") {
      expect(checkValue(result, { status, reason: "😀".repeat(500), value: { title: "Old" } }).ok).toBe(true);
      expect(checkValue(result, { status, value: { title: "" } }).ok).toBe(false);
    }
  }
  expect(checkValue(result, { status: "ok" }).ok).toBe(false);
  expect(checkValue(result, { status: "ok", value: { title: "Ready" }, checkedAt: "x".repeat(129) }).ok).toBe(false);
  expect(checkValue(result, { status: "unknown" }).ok).toBe(false);
});

test("outcome_scenarios_one_per_status", () => {
  const before = JSON.stringify(scenario);
  const expanded = value(outcomeScenarios(scenario, options));
  expect(Object.isFrozen(expanded)).toBe(true);
  expect(Object.isFrozen(expanded[0]?.data.queue)).toBe(true);
  expect(Object.isFrozen(scenario)).toBe(false);
  expect(expanded.map((entry) => entry.name)).toEqual([
    "full.ok",
    "full.unauthorized",
    "full.unavailable",
    "full.stale",
    "full.failed",
  ]);
  for (const entry of expanded) {
    expect(checkValue(result, entry.data.queue).ok).toBe(true);
    expect(entry.data.other).toEqual([]);
    expect(entry.params).toEqual(scenario.params);
    expect(entry.context).toEqual(scenario.context);
    expect(entry.state).toEqual(scenario.state);
  }
  expect(expanded[0]?.data.queue).toEqual({ status: "ok", value: { title: "Ready" } });
  expect(expanded[1]?.data.queue).toEqual({ status: "unauthorized" });
  expect(JSON.stringify(scenario)).toBe(before);
  expect(outcomeScenarios(scenario, options)).toEqual({ ok: true, value: expanded });
  // Recognition survives a JSON round trip; no schema identity registry is needed.
  expect(outcomeScenarios(scenario, { ...options, capabilities: JSON.parse(JSON.stringify(capabilities)) }).ok).toBe(
    true,
  );
});

test("outcome_scenarios_reject_unknown_source", () => {
  for (const source of ["missing", "toString", "__proto__"]) {
    expect(outcomeScenarios(scenario, { ...options, source })).toMatchObject({
      ok: false,
      errors: [{ kind: "unknown-name", pointer: "/source" }],
    });
  }
  const plain = {
    ...capabilities,
    sources: { "queue.read": { ...capabilities.sources["queue.read"]!, result: obj({}) } },
  };
  expect(outcomeScenarios(scenario, { ...options, capabilities: plain })).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-document" }],
  });
  expect(outcomeScenarios(scenario, { ...options, capabilities: { ...capabilities, sources: {} } })).toMatchObject({
    ok: false,
    errors: [{ kind: "unknown-name" }],
  });
});

test("outcome_scenarios_reject_invalid_seed_and_generated_names", () => {
  for (const queue of [{ status: "failed" }, { status: "ok", value: { title: "" } }, null]) {
    expect(outcomeScenarios({ ...scenario, data: { queue } }, options).ok).toBe(false);
  }
  const longName = outcomeScenarios({ ...scenario, name: "😀".repeat(128) }, options);
  expect(longName.ok).toBe(false);
  if (!longName.ok) expect(longName.errors.every((error) => error.pointer === "/name")).toBe(true);
  const nullable = {
    ...capabilities,
    sources: { "queue.read": { ...capabilities.sources["queue.read"]!, result: { ...result, nullable: true } } },
  };
  expect(outcomeScenarios(scenario, { ...options, capabilities: nullable }).ok).toBe(false);
});

/** The 0.3.0 envelope, written out so a change to `sourceOutcome` without the option cannot go unnoticed. */
const outcome030 = (payload: unknown) => {
  const failure = {
    type: "object",
    properties: { reason: { type: "string", maxLength: 500 }, value: payload },
    required: [],
    additionalProperties: false,
  };
  return {
    discriminator: "status",
    mapping: {
      ok: {
        type: "object",
        properties: { checkedAt: { type: "string", maxLength: 128 }, value: payload },
        required: ["value"],
        additionalProperties: false,
      },
      unauthorized: failure,
      unavailable: failure,
      stale: failure,
      failed: failure,
    },
  };
};

test("source_outcome_without_the_option_is_unchanged", () => {
  const payload = obj({ title: str({ minLength: 1, maxLength: 20 }) });
  for (const schema of [
    sourceOutcome(payload),
    sourceOutcome(payload, {}),
    sourceOutcome(payload, { pending: false }),
  ]) {
    expect(schema).toEqual(outcome030(payload) as never);
    expect(canonicalJson(schema)).toBe(canonicalJson(outcome030(payload) as never));
  }
});

test("source_outcome_with_pending_adds_one_closed_variant", () => {
  const pending = sourceOutcome(obj({ title: str({ maxLength: 20 }) }), { pending: true });
  expect(isLanguageSchema(pending)).toBe(true);
  expect(Object.keys(pending.mapping)).toEqual(["ok", "unauthorized", "unavailable", "stale", "failed", "pending"]);
  expect(checkValue(pending, { status: "pending" }).ok).toBe(true);
  expect(checkValue(pending, { status: "pending", value: { title: "x" } }).ok).toBe(false);
  expect(checkValue(pending, { status: "pending", reason: "slow" }).ok).toBe(false);
  expect(checkValue(result, { status: "pending" }).ok).toBe(false);
});

test("unnarrowed_value_read_fails_to_compile", () => {
  const pending = sourceOutcome(obj({ title: str({ maxLength: 20 }) }), { pending: true });
  const seen = (data: Infer<typeof pending>): string => {
    // @ts-expect-error a source that may be pending has no value until narrowed
    const unnarrowed = () => data.value.title;
    expect(unnarrowed).toBeFunction();
    if (data.status === "pending") {
      // @ts-expect-error pending carries no reason
      data.reason;
      return "loading";
    }
    return data.status === "ok" ? data.value.title : data.status;
  };
  expect(seen({ status: "pending" })).toBe("loading");
  expect(seen({ status: "ok", value: { title: "Ready" } })).toBe("Ready");
  // Without the option the union has no pending member.
  // @ts-expect-error pending is not declared
  const absent: Infer<typeof result> = { status: "pending" };
  expect(absent).toBeDefined();
});

test("outcome_scenarios_add_pending_when_declared", () => {
  const pending = sourceOutcome(obj({ title: str({ minLength: 1, maxLength: 20 }) }), { pending: true });
  const declared = value(
    validateCapabilities({
      ...packageOptions.capabilities,
      sources: { "queue.read": { description: "Queue", params: obj({}), result: pending } },
    }),
  );
  const expanded = value(outcomeScenarios(scenario, { ...options, capabilities: declared }));
  expect(expanded.map((entry) => entry.name)).toEqual([
    "full.ok",
    "full.unauthorized",
    "full.unavailable",
    "full.stale",
    "full.failed",
    "full.pending",
  ]);
  expect(expanded[5]?.data.queue).toEqual({ status: "pending" });
});
