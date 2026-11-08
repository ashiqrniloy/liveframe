import { obj, validateCapabilities, validateCatalog } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import { pack } from "../pack/index.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { value } from "./fixture.ts";

/** What `runnerSuite` asks of a runner for one probe (shipped in `conformance/runner/fixtures.json`). */
export type Probe = {
  readonly rule: string;
  readonly tier: "contract" | "isolation";
  readonly kind: "code" | "template";
  readonly package: string;
  readonly libraries?: readonly string[];
  /** `text` is the one text node the tree must contain; `kind` is the first error's kind (any when absent). */
  readonly expect: { readonly ok: true; readonly text: string } | { readonly ok: false; readonly kind?: string };
  /** A probe the runner must stop: it ends within `timeoutMs` + `slackMs`, and the next render succeeds. */
  readonly timed?: true;
  readonly note: string;
};

const head = 'import { jsx, primitive } from "@arnilo/liveframe/sdk";\n';
const show = 'const show = (text: unknown) => jsx(primitive("text"), { text: String(text) });\n';

// Plain strings so a runner in any language can be given the same documents.
const sources = {
  ok: 'export default () => show("ok");',
  throws: 'export default () => { throw new Error("boom"); };',
  nonFunction: "export default 42;",
  invalidTree: 'export default () => jsx(primitive("text"), { text: 7 });',
  // Busy for 400 ms, then returns: a runner that cannot interrupt must still report it.
  spin: 'export default () => { const end = Date.now() + 400; while (Date.now() < end) {} return show("late"); };',
  infinite: "export default () => { for (;;) {} };",
  memoryBomb: "export default () => { const held: unknown[] = []; for (;;) held.push(new Array(1 << 20).fill(1)); };",
  deepRecursion: "const f = (n: number): number => f(n + 1) + 1;\nexport default () => show(f(0));",
  nativeHold: 'export default () => show("a".repeat(1e7).indexOf("a".repeat(5e6) + "b"));',
  globals: `const found: string[] = [];
const scan = (label: string, scope: any, names: string[]) => {
  for (const name of names) {
    try { if (typeof scope[name] !== "undefined") found.push(label + name); } catch {}
  }
};
scan("", globalThis, ["fetch", "process", "Bun", "Deno", "require", "self", "postMessage", "importScripts"]);
try { scan("ctor:", (function () {}).constructor("return this")(), ["fetch", "process", "Bun", "Deno", "require"]); } catch {}
export default () => show(found.length ? found.join(",") : "clean");`,
  forge: `const tree = { forged: "FORGED" };
const send = (post: unknown) => {
  if (typeof post !== "function") return;
  for (let id = 0; id < 16; id++) {
    try { post({ type: "result", id, result: { ok: true, value: tree } }); } catch {}
    try { post({ id, ok: true, value: tree }); } catch {}
  }
};
const g = globalThis as any;
try { send(g.postMessage); } catch {}
try { send(g.self?.postMessage); } catch {}
try { send(g.process?.send?.bind(g.process)); } catch {}
export default () => show("forging done");`,
} as const;

const stateSource = (marker: string) =>
  `let calls = 0;\nexport default () => { const g = globalThis as any; g.__probe_calls = (g.__probe_calls ?? 0) + 1; return show("${marker}:" + ++calls + "/" + g.__probe_calls); };`;

const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} } as const;

function build() {
  const catalog = value(
    validateCatalog({
      format: "liveframe-catalog/1",
      catalogId: "conformance.runner@1",
      description: "Runner conformance fixture",
      vocabulary: {
        colourRoles: [],
        surfaceRoles: [],
        fillableRoles: [],
        typographyRoles: ["body"],
        surfaceTypography: "body",
        space: [],
        radius: [],
        size: [],
        breakpoints: [],
        tones: {},
      },
      definitions: [
        {
          kind: "text",
          props: {
            type: "object",
            properties: { text: { type: "string", maxLength: 10000 } },
            required: ["text"],
            additionalProperties: false,
          },
          children: "none",
          events: {},
          variants: ["default"],
          slots: ["root"],
          styleProps: [],
          a11y: { role: "generic" },
          description: "The text primitive.",
          defaultVariant: "default",
        },
      ],
    }),
  );
  const capabilities = value(validateCapabilities({ format: "liveframe-capabilities/1", actions: {}, sources: {} }));
  const install = { catalog, capabilities };
  const scenarios = [{ name: "default", params: {}, context: {}, data: {} }];
  const manifest = (id: string, extra: Record<string, unknown> = {}) => ({
    format: "liveframe-manifest/1",
    id,
    version: "1",
    catalogId: catalog.catalogId,
    params: obj({}),
    state: obj({}),
    context: obj({}),
    initialState: {},
    sources: {},
    actions: [],
    ...extra,
  });
  const code = (id: string, source: string, libraries: readonly WidgetPackage[] = [], extra = {}) =>
    value(
      pack(
        { files: { "entry.ts": head + show + source }, entry: "entry.ts", manifest: manifest(id, extra), scenarios },
        { ...install, libraries },
      ),
    );
  const packages: Record<string, WidgetPackage> = {};
  for (const [name, source] of Object.entries(sources)) packages[name] = code(`probe.${name}`, source);
  // The packer refuses `import.meta`, so this probe is linked by hand and rehashed.
  const ok0 = packages["ok"] as WidgetPackage;
  const { hash: _hash, ...body } = {
    ...ok0,
    manifest: { ...ok0.manifest, id: "probe.import-meta" },
    code: `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
const found = [];
for (const name of ["require", "dir", "dirname", "path"]) {
  try { if (typeof import.meta[name] !== "undefined") found.push("meta:" + name); } catch {}
}
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: found.length ? found.join(",") : "clean" });`,
  };
  packages["importMeta"] = { ...body, hash: packageHash(body) };
  packages["stateA"] = code("probe.state-a", stateSource("A"));
  packages["stateB"] = code("probe.state-b", stateSource("B"));
  packages["templateOk"] = value(
    pack(
      {
        template: { format: "liveframe-template/1", root: { kind: "text", props: { text: "ok" } } },
        manifest: manifest("probe.template"),
        scenarios,
      },
      install,
    ),
  );
  const library = value(
    pack(
      {
        files: { "entry.ts": 'export const answer = "42"; export default () => null;' },
        entry: "entry.ts",
        manifest: manifest("probe.lib", { exports: ["answer"] }),
        scenarios,
      },
      install,
    ),
  );
  packages["dependent"] = value(
    pack(
      {
        files: {
          "entry.ts": `${head}import { answer } from "liveframe:lib/probe.lib@1";\nexport default () => jsx(primitive("text"), { text: answer });`,
        },
        entry: "entry.ts",
        manifest: manifest("probe.dependent"),
        scenarios,
      },
      { ...install, libraries: [library] },
    ),
  );
  // Tampered after hashing: the stale hash is the only thing wrong, so only verification can refuse it.
  const ok = packages["ok"] as WidgetPackage;
  const templateOk = packages["templateOk"] as WidgetPackage;
  packages["tamperedCode"] = { ...ok, code: `for (;;) {}\n${ok.code}` } as WidgetPackage;
  packages["tamperedTemplate"] = {
    ...templateOk,
    template: { format: "liveframe-template/1", root: { kind: "text", props: { text: "tampered" } } },
  } as WidgetPackage;
  const libraries = { "probe.lib": library };

  const probe = (
    rule: string,
    tier: Probe["tier"],
    kind: Probe["kind"],
    pkg: string,
    expect: Probe["expect"],
    note: string,
    extra: Partial<Probe> = {},
  ): Probe => ({ rule, tier, kind, package: pkg, expect, note, ...extra });
  const text = (value: string) => ({ ok: true, text: value }) as const;
  const fails = (kind?: string) => ({ ok: false, ...(kind ? { kind } : {}) }) as const;
  const probes: Probe[] = [
    probe("runner_returns_render_tree", "contract", "code", "ok", text("ok"), "A code widget renders its tree"),
    probe(
      "runner_returns_render_tree",
      "contract",
      "template",
      "templateOk",
      text("ok"),
      "A template renders its tree",
    ),
    probe(
      "runner_refuses_hash_mismatch",
      "contract",
      "code",
      "tamperedCode",
      fails("hash-mismatch"),
      "Refused before loading: the tampered code never runs",
    ),
    probe(
      "runner_refuses_hash_mismatch",
      "contract",
      "template",
      "tamperedTemplate",
      fails("hash-mismatch"),
      "Refused before rendering",
    ),
    probe("runner_reports_thrown_widget", "contract", "code", "throws", fails("render-failed"), "A widget that throws"),
    probe(
      "runner_rejects_non_function_default",
      "contract",
      "code",
      "nonFunction",
      fails("render-failed"),
      "A default export that is not a function",
    ),
    probe(
      "runner_never_accepts_invalid_tree",
      "contract",
      "code",
      "invalidTree",
      fails(),
      "A tree the validator rejects is never ok",
    ),
    probe(
      "runner_bounds_time",
      "contract",
      "code",
      "spin",
      fails("limit-exceeded"),
      "A widget that outlives timeoutMs",
      { timed: true },
    ),
    probe(
      "runner_loads_libraries",
      "contract",
      "code",
      "dependent",
      text("42"),
      "A pinned library loads before its dependent",
      { libraries: ["probe.lib"] },
    ),
    probe(
      "runner_loads_libraries",
      "contract",
      "code",
      "dependent",
      fails("not-found"),
      "A pinned library that was not supplied is not found",
    ),
    probe(
      "runner_isolation_no_host_globals",
      "isolation",
      "code",
      "globals",
      text("clean"),
      "No host global is reachable",
    ),
    probe(
      "runner_isolation_no_host_globals",
      "isolation",
      "code",
      "importMeta",
      text("clean"),
      "import.meta carries no host member",
    ),
    probe(
      "runner_isolation_infinite_loop",
      "isolation",
      "code",
      "infinite",
      fails("limit-exceeded"),
      "A loop that never ends",
      { timed: true },
    ),
    probe(
      "runner_isolation_memory_bomb",
      "isolation",
      "code",
      "memoryBomb",
      fails("limit-exceeded"),
      "Memory grows without bound",
      { timed: true },
    ),
    probe(
      "runner_isolation_deep_recursion",
      "isolation",
      "code",
      "deepRecursion",
      fails("limit-exceeded"),
      "Recursion without a base case",
      { timed: true },
    ),
    probe(
      "runner_isolation_native_hold",
      "isolation",
      "code",
      "nativeHold",
      fails("limit-exceeded"),
      "One native call that cannot be interrupted",
      { timed: true },
    ),
  ];
  return { catalog, capabilities, inputs, packages, libraries, probes };
}

let cached: ReturnType<typeof build> | undefined;
/** The suite's own catalog, capabilities, packages and probe table, built once. */
export function runnerFixtures() {
  cached ??= build();
  return cached;
}

/** The language-neutral document `conformance/runner/fixtures.json` (see `scripts/runner-fixtures.ts`). */
export function runnerFixtureDocument() {
  const { catalog, capabilities, inputs, packages, libraries, probes } = runnerFixtures();
  return {
    format: "liveframe-runner-conformance/1",
    timeoutMs: 100,
    slackMs: 1000,
    okTimeoutMs: 5000,
    catalog,
    capabilities,
    inputs,
    packages,
    libraries,
    probes,
  };
}
