import { expect, test } from "bun:test";
import { jsx, primitive, render } from "@arnilo/liveframe/sdk";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import { pack, type WidgetPackage } from "../pack/index.ts";
import { workerRunner } from "../preview/worker/index.ts";
import type { WorkerMessage } from "../preview/worker/protocol.ts";
import { createWorkerRunner } from "../preview/worker/runner.ts";
import { cachedValidatorCount } from "../runner-kit/cache.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "runner", revision: 1 };
const packages = drafts.map((draft) => value(pack(draft, options)));
const base = packages[0];
const inputs = proofWidgets[0]?.scenarios[0];
if (!base || !inputs) throw new Error("Missing agent-home fixture");
const simpleCode = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" });`;
function withCode(code: string): WidgetPackage {
  const pkg = { ...base, code } as WidgetPackage;
  return { ...pkg, hash: packageHash(pkg) };
}

test("worker_constructor_timeout_reaches_render", async () => {
  const runner = workerRunner({ timeoutMs: 10000 });
  const slow = withCode(
    simpleCode.replace(
      'text: "ok"',
      'text: String((() => { const start = Date.now(); while (Date.now() - start < 150) {} return "ok"; })())',
    ),
  );
  try {
    expect((await runner.render(slow, inputs, options)).ok).toBe(true);
    expect(await runner.render(slow, inputs, { ...options, timeoutMs: 50 })).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded" }],
    });
  } finally {
    runner.close();
  }
}, 30000);

test("worker_matches_render", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    for (const [i, fixture] of proofWidgets.entries()) {
      const pkg = packages[i];
      if (!pkg) throw new Error("Missing packed widget");
      const validator = compileValidator({ ...options, manifest: pkg.manifest });
      for (const scenario of fixture.scenarios) {
        const expected = render(fixture.widget, scenario, { ...options, validator });
        expect(expected.ok, `${fixture.name}/${scenario.name}`).toBe(true);
        expect(await runner.render(pkg, scenario, options)).toEqual(expected);
      }
    }
  } finally {
    runner.close();
  }
});

test("worker_times_out_then_recovers", async () => {
  const runner = workerRunner();
  try {
    for (const code of ["while (true) {}", "export default () => { while (true) {} };"]) {
      expect(await runner.render(withCode(code), inputs, options)).toMatchObject({
        ok: false,
        errors: [{ kind: "limit-exceeded" }],
      });
      expect((await runner.render(withCode(simpleCode), inputs, { ...options, timeoutMs: 2000 })).ok).toBe(true);
    }
    const slow = withCode(
      simpleCode.replace(
        'text: "ok"',
        'text: String((() => { const start = Date.now(); while (Date.now() - start < 50) {} return "ok"; })())',
      ),
    );
    expect(await runner.render(slow, inputs, { ...options, timeoutMs: 10 })).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded" }],
    });
  } finally {
    runner.close();
  }
}, 5000);

test("worker_crash_is_render_failed", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const counted = withCode(
    simpleCode
      .replace("export default () =>", "let count = 0; export default () =>")
      .replace('text: "ok"', "text: String(++count)"),
  );
  try {
    for (const code of [
      "throw new Error('load failed');",
      "export default 3;",
      "self.close(); export default () => { while (true) {} };",
      "queueMicrotask(() => { throw new Error('worker crashed'); }); await new Promise(() => {});",
    ]) {
      const before = await runner.render(counted, inputs, options);
      expect(before).toMatchObject({ ok: true });
      const failure = await runner.render(withCode(code), inputs, options);
      expect(failure).toMatchObject({ ok: false, errors: [{ kind: "render-failed" }] });
      expect(JSON.stringify(failure)).not.toMatch(/load failed|worker crashed/);
      const after = await runner.render(counted, inputs, options);
      expect(after).toMatchObject({ ok: true });
      if (after.ok) expect(after.value.root.props.text).toBe("1");
    }
  } finally {
    runner.close();
  }
});

test("worker_serialises_requests_and_clones_results", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const pkg = withCode(
    simpleCode
      .replace("export default () =>", "let count = 0; export default () =>")
      .replace('text: "ok"', "text: String(++count)"),
  );
  try {
    const results = await Promise.all(Array.from({ length: 6 }, () => runner.render(pkg, inputs, options)));
    for (const [i, result] of results.entries()) {
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.value.root.props.text).toBe(String(i + 1));
    }
    const first = results[0];
    if (first?.ok) (first.value.root.props as Record<string, unknown>).text = "changed";
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
    const [timeout, recovered] = await Promise.all([
      runner.render(withCode("while (true) {}"), inputs, { ...options, timeoutMs: 20 }),
      runner.render(pkg, inputs, options),
    ]);
    expect(timeout).toMatchObject({ ok: false, errors: [{ kind: "limit-exceeded" }] });
    expect(recovered).toMatchObject({ ok: true });
    if (recovered.ok) expect(recovered.value.root.props.text).toBe("1");
  } finally {
    runner.close();
  }
});

test("worker_preserves_validation_and_recovers_from_clone_failure", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const pkg = withCode(simpleCode);
  try {
    expect(await runner.render(pkg, inputs, { ...options, limits: { nodes: 0 } })).toMatchObject({
      ok: false,
      errors: [{ kind: "invalid-prop" }],
    });
    expect(await runner.render(pkg, { ...inputs, state: {} }, options)).toMatchObject({ ok: false });
    const denied = { ...catalog, definitions: [] };
    const validator = compileValidator({ ...options, catalog: denied, manifest: pkg.manifest });
    const expected = render(() => jsx(primitive("text"), { text: "ok" }), inputs, { ...options, validator });
    expect(expected.ok).toBe(false);
    expect(await runner.render(pkg, inputs, { ...options, catalog: denied })).toEqual(expected);
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
    expect(await runner.render(pkg, { ...inputs, data: { callback: () => {} } }, options)).toMatchObject({
      ok: false,
      errors: [{ kind: "render-failed" }],
    });
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
});

test("worker_reuses_cloned_configuration_until_identity_changes", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const sent: WorkerMessage[] = [];
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (message: WorkerMessage) {
    sent.push(message);
    return post.call(this, message);
  };
  const configures = () => sent.filter((message) => message.type === "configure").length;
  try {
    expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
    expect(configures()).toBe(1);
    expect((await runner.render(withCode(simpleCode), inputs, { ...options, revision: 2 })).ok).toBe(true);
    expect((await runner.render(withCode(`${simpleCode}\n// new hash`), inputs, options)).ok).toBe(true);
    expect(configures()).toBe(1);
    expect(
      (await runner.render(withCode(simpleCode), inputs, { ...options, capabilities: { ...capabilities } })).ok,
    ).toBe(true);
    expect(configures()).toBe(2);
    expect((await runner.render(withCode(simpleCode), inputs, { ...options, catalog: { ...catalog } })).ok).toBe(true);
    expect(configures()).toBe(3);
  } finally {
    Worker.prototype.postMessage = post;
    runner.close();
  }
});

test("worker_close_settles_active_queued_and_future_requests", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
  const active = runner.render(withCode("while (true) {}"), inputs, options);
  const queued = runner.render(withCode(simpleCode), inputs, options);
  await new Promise((resolve) => setTimeout(resolve, 20));
  runner.close();
  runner.close();
  for (const result of await Promise.all([active, queued, runner.render(withCode(simpleCode), inputs, options)]))
    expect(result).toMatchObject({ ok: false, errors: [{ kind: "render-failed" }] });
});

test("worker_warm_overhead_report", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const fixture = proofWidgets[0];
  if (!fixture) throw new Error("Missing widget");
  const validator = compileValidator({ ...options, manifest: base.manifest });
  try {
    for (let i = 0; i < 20; i++) value(await runner.render(base, inputs, options));
    let direct = 0;
    let worker = 0;
    for (let i = 0; i < 100; i++) {
      let start = performance.now();
      value(render(fixture.widget, inputs, { ...options, validator }));
      direct += performance.now() - start;
      start = performance.now();
      value(await runner.render(base, inputs, options));
      worker += performance.now() - start;
    }
    console.info(
      `worker warm overhead: ${((worker - direct) / 100).toFixed(4)} ms/render (direct ${(direct / 100).toFixed(4)}, worker ${(worker / 100).toFixed(4)})`,
    );
  } finally {
    runner.close();
  }
}, 30000);

test("forged_worker_result_is_revalidated_on_the_host", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  // The widget shares the worker's realm, so it can answer with the pending id.
  const forged = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
const forward = self.onmessage;
self.onmessage = (event) => {
  if (event.data?.type === "render")
    self.postMessage({ type: "result", id: event.data.id, result: { ok: true, value: { forged: "<script>" } } });
  return forward(event);
};
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" });`;
  const pkg = withCode(forged);
  try {
    // The widget installs the wrapper while its own module loads, so its next render is forged.
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
    const validator = compileValidator({ ...options, manifest: pkg.manifest });
    const expected = validator.validateTree({ forged: "<script>" });
    expect(expected.ok).toBe(false);
    expect(await runner.render(withCode(simpleCode), inputs, options)).toEqual(expected);
    expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
});

test("malformed_worker_error_result_is_replaced_and_worker_recycled", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const entry = { kind: "invalid-prop", pointer: "/root", message: "bad" };
  const answers: Record<string, string> = {
    "errors is a string": '{ ok: false, errors: "x" }',
    "10,000 errors": `{ ok: false, errors: Array.from({ length: 10000 }, () => (${JSON.stringify(entry)})) }`,
    "no errors": "{ ok: false, errors: [] }",
    "a non-string kind": '{ ok: false, errors: [{ kind: 7, pointer: "", message: "" }] }',
    "an extra field": `{ ok: false, errors: [{ ...${JSON.stringify(entry)}, stack: "at /home/app" }] }`,
    "a null result": "null",
    "a truthy ok": "{ ok: 1, value: {} }",
  };
  try {
    for (const [name, answer] of Object.entries(answers)) {
      // The widget shares the worker's realm, so its wrapper answers the next render.
      const forging = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
const forward = self.onmessage;
self.onmessage = (event) => {
  if (event.data?.type === "render") self.postMessage({ type: "result", id: event.data.id, result: ${answer} });
  return forward(event);
};
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: ${JSON.stringify(name)} });`;
      expect((await runner.render(withCode(forging), inputs, options)).ok).toBe(true);
      const replaced = await runner.render(withCode(`${simpleCode}\n// victim of ${name}`), inputs, options);
      expect(replaced).toEqual({
        ok: false,
        errors: [{ kind: "render-failed", pointer: "", message: "Worker returned a malformed result" }],
      });
      // The recycled worker no longer carries the forging wrapper.
      expect((await runner.render(withCode(`${simpleCode}\n// after ${name}`), inputs, options)).ok).toBe(true);
    }
  } finally {
    runner.close();
  }
}, 15000);

test("worker_debug_returns_bounded_thrown_text_only_when_asked", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const failing = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => { throw new TypeError("x".repeat(1500)); };`;
  try {
    const result = await runner.render(withCode(failing), inputs, options);
    expect(result).toMatchObject({ ok: false, errors: [{ kind: "render-failed", message: "Widget threw TypeError" }] });
    expect(!result.ok && result.errors[0]).not.toHaveProperty("debug");
    const debug = await runner.render(withCode(failing), inputs, { ...options, debug: true });
    expect(debug).toMatchObject({
      ok: false,
      errors: [{ message: "Widget threw TypeError", debug: "x".repeat(1000) }],
    });
  } finally {
    runner.close();
  }
});

test("unsolicited_result_terminates_the_worker", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  // A second answer to the next render, with an id the host never asked for.
  const stray = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
const forward = self.onmessage;
self.onmessage = (event) => {
  if (event.data?.type === "render")
    self.postMessage({ type: "result", id: event.data.id + 1000, result: { ok: true, value: { hijacked: true } } });
  return forward(event);
};
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "stray" });`;
  // P2's probe: a timer that answers every later render of another package.
  const spam = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
setInterval(() => self.postMessage({ type: "result", id: 0, result: { ok: true, value: { hijacked: true } } }), 0);
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "spam" });`;
  try {
    expect((await runner.render(withCode(stray), inputs, options)).ok).toBe(true);
    const refused = await runner.render(withCode(simpleCode), inputs, options);
    expect(refused).toMatchObject({ ok: false, errors: [{ kind: "render-failed" }] });
    if (!refused.ok) expect(refused.errors[0]?.expected).toContain("pending render id");
    // The worker was terminated, so the stray module answers nothing further.
    for (let i = 0; i < 20; i++) {
      const result = await runner.render(withCode(`${simpleCode}\n// victim ${i}`), inputs, options);
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.value.root.props.text).toBe("ok");
    }
    await runner.render(withCode(spam), inputs, options);
    let hijacked = 0;
    for (let i = 0; i < 20; i++) {
      const result = await runner.render(withCode(`${simpleCode}\n// spam victim ${i}`), inputs, options);
      if (result.ok && (result.value as { hijacked?: boolean }).hijacked) hijacked++;
      else if (result.ok) expect(result.value.root.props.text).toBe("ok");
      else expect(result.errors[0]?.kind).toBe("render-failed");
    }
    expect(hijacked).toBe(0);
    expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
}, 15000);

test("worker_tree_failing_host_validation_is_rejected", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  // The worker validates this tree before the widget's microtask spoils it, so
  // only the clone the host receives carries the invalid prop.
  const mutated = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => {
  const options = [{ value: "a", label: "A" }];
  const tree = __lf_sdk0.jsx(__lf_sdk0.primitive("select"), { label: "Pick", options });
  queueMicrotask(() => { options[0].value = 42; });
  return tree;
};`;
  try {
    const result = await runner.render(withCode(mutated), inputs, options);
    expect(result).toMatchObject({ ok: false, errors: [{ kind: "invalid-prop", nodeId: "root" }] });
    if (!result.ok) expect(result.errors[0]?.pointer).toBe("/root/props/options/0/value");
    expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
});

test("worker_refuses_forged_hash_before_loading", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const loaded = withCode(simpleCode);
  try {
    expect((await runner.render(loaded, inputs, options)).ok).toBe(true);
    const forged = { ...loaded, code: "throw new Error('the forged module was loaded');" };
    expect(await runner.render(forged, inputs, options)).toMatchObject({
      ok: false,
      errors: [{ kind: "hash-mismatch", pointer: "/hash" }],
    });
    expect((await runner.render(loaded, inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
});

test("worker_recycles_after_max_packages", async () => {
  const runner = workerRunner({ timeoutMs: 2000, maxPackages: 2 });
  const counted = (marker: number) =>
    withCode(`import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
let renders = 0;
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: String(++renders) });\n// ${marker}`);
  const text = async (pkg: WidgetPackage): Promise<unknown> => {
    const result = await runner.render(pkg, inputs, options);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.value.root.props.text;
  };
  try {
    const [first, second, third] = [counted(0), counted(1), counted(2)];
    if (!first || !second || !third) throw new Error("Missing package");
    expect(await text(first)).toBe("1");
    expect(await text(first)).toBe("2");
    expect(await text(second)).toBe("1");
    expect(await text(first)).toBe("3");
    // The third distinct hash restarts the worker, so loaded modules start over.
    expect(await text(third)).toBe("1");
    expect(await text(first)).toBe("1");
  } finally {
    runner.close();
  }
});

test("worker_runner_reuses_validator_per_package_hash", async () => {
  const runner = workerRunner({ timeoutMs: 10000 });
  const before = cachedValidatorCount(catalog, capabilities);
  try {
    expect((await runner.render(base, inputs, options)).ok).toBe(true);
    const cached = cachedValidatorCount(catalog, capabilities);
    expect(cached - before).toBeLessThanOrEqual(1);
    expect((await runner.render(base, inputs, options)).ok).toBe(true);
    expect(cachedValidatorCount(catalog, capabilities)).toBe(cached);
  } finally {
    runner.close();
  }
});

function wrapRealWorkerWithReadyDelay(
  url: URL,
  delayMs: number,
  hooks: { onReadyDelivered?: () => void; onPostMessage?: (message: WorkerMessage) => void } = {},
): Worker {
  const real = new Worker(url);
  let onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  const proxy = {
    set onmessage(handler: ((event: MessageEvent<WorkerMessage>) => void) | null) {
      onmessage = handler;
    },
    get onmessage() {
      return onmessage;
    },
    set onerror(handler: ((event: ErrorEvent) => void) | null) {
      real.onerror = handler;
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      real.addEventListener(type, listener);
    },
    postMessage(message: WorkerMessage) {
      hooks.onPostMessage?.(message);
      real.postMessage(message);
    },
    terminate() {
      if (readyTimer !== undefined) clearTimeout(readyTimer);
      real.terminate();
    },
  };
  real.onmessage = (event: MessageEvent<WorkerMessage>) => {
    if (event.data?.type === "ready" && delayMs > 0) {
      readyTimer = setTimeout(() => {
        hooks.onReadyDelivered?.();
        onmessage?.(event);
      }, delayMs);
      return;
    }
    if (event.data?.type === "ready") hooks.onReadyDelivered?.();
    onmessage?.(event);
  };
  return proxy as unknown as Worker;
}

test("slow_worker_boot_does_not_count_against_the_render_timeout", async () => {
  const timeoutMs = 500;
  const runner = createWorkerRunner({ timeoutMs, startTimeoutMs: 5000 }, (url) =>
    wrapRealWorkerWithReadyDelay(url, timeoutMs * 3),
  );
  try {
    const result = await runner.render(withCode(simpleCode), inputs, options);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.root.props.text).toBe("ok");
  } finally {
    runner.close();
  }
}, 15000);

test("worker_that_never_starts_is_render_failed", async () => {
  let spawns = 0;
  let silentTerminated = 0;
  const runner = createWorkerRunner({ timeoutMs: 100, startTimeoutMs: 1000 }, (url) => {
    if (spawns++ === 0) {
      return {
        onmessage: null,
        onerror: null,
        addEventListener() {},
        postMessage() {},
        terminate() {
          silentTerminated++;
        },
      } as unknown as Worker;
    }
    return new Worker(url);
  });
  try {
    const failed = await runner.render(withCode(simpleCode), inputs, options);
    expect(failed).toEqual({
      ok: false,
      errors: [{ kind: "render-failed", pointer: "", message: "Worker did not start" }],
    });
    expect(silentTerminated).toBe(1);
    const recovered = await runner.render(withCode(simpleCode), inputs, { ...options, timeoutMs: 2000 });
    expect(recovered).toMatchObject({ ok: true });
  } finally {
    runner.close();
  }
}, 15000);

test("render_after_a_timeout_recycle_gets_a_full_budget", async () => {
  let spawns = 0;
  const timeoutMs = 500;
  const runner = createWorkerRunner({ timeoutMs, startTimeoutMs: 5000 }, (url) => {
    const index = spawns++;
    return index === 0 ? new Worker(url) : wrapRealWorkerWithReadyDelay(url, timeoutMs * 3);
  });
  try {
    const timedOut = await runner.render(withCode("while (true) {}"), inputs, { ...options, timeoutMs: 40 });
    expect(timedOut).toMatchObject({ ok: false, errors: [{ kind: "limit-exceeded" }] });
    const recovered = await runner.render(withCode(simpleCode), inputs, options);
    expect(recovered).toMatchObject({ ok: true });
    if (recovered.ok) expect(recovered.value.root.props.text).toBe("ok");
    expect(spawns).toBe(2);
  } finally {
    runner.close();
  }
}, 15000);

test("ready_from_a_replaced_worker_is_ignored", async () => {
  let spawns = 0;
  const first: { onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null } = { onmessage: null };
  const postedToFirst: WorkerMessage[] = [];
  let secondReadyDelivered = false;
  let readyDeliveredBeforePost = false;

  const runner = createWorkerRunner({ timeoutMs: 100, startTimeoutMs: 1000 }, (url) => {
    if (spawns++ === 0) {
      return {
        set onmessage(handler: ((event: MessageEvent<WorkerMessage>) => void) | null) {
          first.onmessage = handler;
        },
        get onmessage() {
          return first.onmessage;
        },
        onerror: null,
        addEventListener() {},
        postMessage(message: WorkerMessage) {
          postedToFirst.push(message);
        },
        terminate() {},
      } as unknown as Worker;
    }
    return wrapRealWorkerWithReadyDelay(url, 60, {
      onReadyDelivered: () => {
        secondReadyDelivered = true;
      },
      onPostMessage: () => {
        readyDeliveredBeforePost = secondReadyDelivered;
      },
    });
  });

  try {
    const failed = await runner.render(withCode(simpleCode), inputs, options);
    expect(failed).toMatchObject({ ok: false, errors: [{ kind: "render-failed", message: "Worker did not start" }] });

    const nextRender = runner.render(withCode(simpleCode), inputs, { ...options, timeoutMs: 2000 });
    // Emit a late ready from the replaced first worker while the second worker is starting.
    await new Promise((resolve) => setTimeout(resolve, 10));
    first.onmessage?.({ data: { type: "ready" } } as MessageEvent<WorkerMessage>);

    const result = await nextRender;
    expect(result).toMatchObject({ ok: true });
    expect(postedToFirst).toEqual([]);
    expect(readyDeliveredBeforePost).toBe(true);
  } finally {
    runner.close();
  }
}, 15000);
