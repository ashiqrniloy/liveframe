// Regenerates src/__tests__/fixtures/proof/*.json; run with --out to choose another directory.
import { deepStrictEqual, ok } from "node:assert/strict";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  type Catalog,
  type DesignSystem,
  type Result,
  type Theme,
  type UiNode,
  resolveRecipes,
  validateCatalog,
  validateCapabilities,
  validateManifest,
  validateTheme,
  validateDesignSystem,
} from "../../src/index.ts";
import { schemaDocument } from "../../src/formats/registry.ts";
import { catalog as baseCatalog, schema } from "./export-catalog.ts";
import { certifiedTheme } from "../styles/certified/theme.ts";
import { rackTheme } from "../styles/rack/theme.ts";
import { certifiedDesignSystem } from "../styles/certified/design-system.ts";
import { rackDesignSystem } from "../styles/rack/design-system.ts";
import {
  propertyTypes,
  type Theme as ProofTheme,
  type DesignSystem as ProofSystem,
  type ShadowLayer,
} from "../styles/types.ts";
import { completeRecipes } from "../styles/recipes.ts";
import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { gitFixture, rackFixture } from "../host/fixtures/clay.ts";
import { render, WidgetError, type UiTree } from "../runtime/index.ts";
import {
  agentHomeActions,
  agentHomeOptions,
  initialQueueState,
  queueParams,
  type QueueItem,
} from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";
import { coreQueueOptions } from "../widgets/core-queue/manifest.ts";
import { CoreQueue } from "../widgets/core-queue/widget.tsx";
import { GitStatus } from "../widgets/clay/git-status.tsx";
import { RackModule } from "../widgets/clay/rack-module.tsx";
import { gitOptions, initialRackState, rackOptions } from "../widgets/clay/manifest.ts";

const start = performance.now();
const args = Bun.argv.slice(2);
ok(args.length === 0 || (args.length === 2 && args[0] === "--out"), "Usage: export-formats.ts [--out directory]");
const out = resolve(args[1] ?? new URL("../../src/__tests__/fixtures/proof", import.meta.url).pathname);
const documents: Record<string, unknown> = {};
const px = (value: number) => ({ value, unit: "px" as const });
function checked<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function colour(value: string): Theme["colours"][string] {
  if (value === "transparent") return { colorSpace: "srgb", components: [0, 0, 0], alpha: 0 };
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) {
    const components = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
    return {
      colorSpace: "srgb",
      components,
      ...(value.length === 9 ? { alpha: parseInt(value.slice(7), 16) / 255 } : {}),
    };
  }
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(value);
  if (match)
    return {
      colorSpace: "oklch",
      components: [Number(match[1]), Number(match[2]), Number(match[3])],
      ...(match[4] === undefined ? {} : { alpha: Number(match[4]) }),
    };
  const mix = /^color-mix\(in oklab, (oklch\([^)]+\)) ([\d.]+)%, (oklch\([^)]+\))\)$/.exec(value);
  ok(mix?.[1] && mix[3], `Unsupported proof colour: ${value}`);
  const a = colour(mix[1]).components as readonly [number, number, number];
  const b = colour(mix[3]).components as readonly [number, number, number];
  // This proof's two opaque colours share a hue: OKLab interpolation keeps it exactly.
  ok(a[2] === b[2], "Proof mix must have equal hues");
  const weight = Number(mix[2]) / 100;
  return {
    colorSpace: "oklch",
    components: [a[0] * weight + b[0] * (1 - weight), a[1] * weight + b[1] * (1 - weight), a[2]],
  };
}

const alphaRoles = new Map<string, { role: string; opacity: number }>();
function shadows(layers: readonly ShadowLayer[]) {
  return layers.map((layer) => {
    const name = `${layer.colorRole}.alpha-${String(layer.opacity).replace(".", "-")}`;
    alphaRoles.set(name, { role: layer.colorRole, opacity: layer.opacity });
    return {
      color: name,
      offsetX: px(layer.x),
      offsetY: px(layer.y),
      blur: px(layer.blur),
      spread: px(layer.spread),
      ...(layer.inset === undefined ? {} : { inset: layer.inset }),
    };
  });
}
function literal(kind: string, value: unknown): unknown {
  if (kind === "shadow") return shadows(value as readonly ShadowLayer[]);
  if (kind === "motion-duration") return { value, unit: "ms" };
  if (["opacity", "saturation", "easing"].includes(kind)) return value;
  ok(typeof value === "number", `Expected numeric ${kind}`);
  return px(value);
}
function recipes(system: ProofSystem, expand: boolean) {
  return Object.fromEntries(
    Object.entries(completeRecipes(system.recipes)).map(([key, recipe]) => [
      key,
      Object.fromEntries(
        Object.entries(recipe).map(([property, input]) => {
          if (property === "transformPreset") {
            ok(input === "none" || input === "press-shift-down", "Unsupported proof transform");
            return ["translateY", px(input === "none" ? 0 : 1)];
          }
          const kind = propertyTypes[property as keyof typeof propertyTypes];
          if (["colour", "typography", "line-style"].includes(kind)) return [property, input];
          const value = typeof input === "string" ? system.values[input] : undefined;
          if (expand && value) return [property, literal(value.type, value.value)];
          return [property, typeof input === "string" ? input : literal(kind, input)];
        }),
      ),
    ]),
  );
}
function system(input: ProofSystem): DesignSystem {
  return {
    format: "liveframe-design-system/1",
    id: input.id,
    version: "1.0.0",
    values: Object.fromEntries(
      Object.entries(input.values).map(([name, entry]) => [
        name,
        { kind: entry.type, value: literal(entry.type, entry.value) },
      ]),
    ) as DesignSystem["values"],
    recipes: recipes(input, false) as DesignSystem["recipes"],
  };
}
const systems = [system(certifiedDesignSystem), system(rackDesignSystem)];
const catalog: Catalog = checked(
  validateCatalog({
    ...baseCatalog,
    vocabulary: {
      ...baseCatalog.vocabulary,
      colourRoles: [...baseCatalog.vocabulary.colourRoles, ...alphaRoles.keys()],
    },
  }),
);
documents.catalog = catalog;
documents.vocabulary = catalog.vocabulary;

function theme(input: ProofTheme): Theme {
  const colours = Object.fromEntries(Object.entries(input.colours).map(([name, value]) => [name, colour(value)]));
  for (const [name, { role, opacity }] of alphaRoles) {
    const base = colours[role];
    ok(base, "Missing proof shadow role");
    colours[name] = { ...base, alpha: (base.alpha ?? 1) * opacity };
  }
  return {
    format: "liveframe-theme/1",
    id: input.id,
    version: "1.0.0",
    colorScheme: "light",
    colours,
    typography: Object.fromEntries(
      Object.entries(input.typography).map(([name, entry]) => {
        const { letterSpacing, fontStretch, ...rest } = entry;
        return [
          name,
          {
            ...rest,
            fontFamily: entry.fontFamily.split(",").map((font) => font.trim().replace(/^"|"$/g, "")),
            fontSize: px(entry.fontSize),
            ...(letterSpacing === undefined ? {} : { letterSpacing: { value: letterSpacing, unit: "em" as const } }),
            ...(fontStretch === undefined ? {} : { fontStretch: Number(fontStretch.replace("%", "")) }),
          },
        ];
      }),
    ),
  };
}
for (const [i, source] of ([certifiedDesignSystem, rackDesignSystem] as ProofSystem[]).entries()) {
  const ds = systems[i];
  ok(ds);
  const convertedTheme = checked(validateTheme(theme(i === 0 ? certifiedTheme : rackTheme), catalog.vocabulary));
  checked(validateDesignSystem(ds, { catalog, registry: {} }));
  const table = resolveRecipes(ds, { catalog, registry: {} });
  const expected = recipes(source, true);
  deepStrictEqual(table, Object.assign(Object.create(null), expected), `${source.id} recipe conversion drift`);
  // Expand alpha roles back to source role + opacity before comparing the proof's shadow layers.
  for (const [key, recipe] of Object.entries(source.recipes)) {
    const value = typeof recipe.shadow === "string" ? source.values[recipe.shadow]?.value : recipe.shadow;
    if (!Array.isArray(value)) continue;
    const converted = table[key as keyof typeof table]?.shadow;
    ok(Array.isArray(converted));
    deepStrictEqual(
      converted.map((layer) => {
        const alpha = alphaRoles.get(layer.color);
        ok(alpha);
        const base = convertedTheme.colours[alpha.role];
        ok(base);
        deepStrictEqual(convertedTheme.colours[layer.color], { ...base, alpha: (base.alpha ?? 1) * alpha.opacity });
        return {
          x: layer.offsetX.value,
          y: layer.offsetY.value,
          blur: layer.blur.value,
          spread: layer.spread.value,
          colorRole: alpha.role,
          opacity: alpha.opacity,
          ...(layer.inset === undefined ? {} : { inset: layer.inset }),
        };
      }),
      value,
    );
  }
  documents[`${source.id}.theme`] = convertedTheme;
  documents[`${source.id}.design-system`] = ds;
  documents[`${source.id}.resolved-recipes`] = expected;
}
const capabilities = checked(
  validateCapabilities({
    format: "liveframe-capabilities/1",
    sources: {},
    actions: Object.fromEntries(
      Object.entries(agentHomeActions).map(([name, args]) => [
        name,
        { description: `Proof action ${name}.`, args: schema(args) },
      ]),
    ),
  }),
);
documents.capabilities = capabilities;
ok(agentHomeOptions.params && agentHomeOptions.context);
documents["agent-home.manifest"] = checked(
  validateManifest(
    {
      format: "liveframe-manifest/1",
      id: "agent-home",
      version: "1.0.0",
      catalogId: catalog.catalogId,
      params: schema(agentHomeOptions.params),
      state: schema(agentHomeOptions.state),
      context: schema(agentHomeOptions.context),
      initialState: initialQueueState,
      sources: {},
      actions: Object.keys(agentHomeActions),
    },
    { catalog, capabilities },
  ),
);

function tree(name: string, input: UiTree | WidgetError) {
  if (input instanceof WidgetError) throw input;
  function convert(node: UiNode): UiNode {
    const columns = node.style?.columns;
    // Benchmark fixtures use spec-valid compact tracks in place of the proof's fit extension.
    const compactTracks = Array.isArray(columns) && columns.includes("fit");
    return {
      ...node,
      ...(compactTracks
        ? { style: { ...node.style, columns: columns.map((track) => (track === "fit" ? "0fr" : track)) } }
        : {}),
      ...(node.events
        ? {
            events: Object.fromEntries(
              Object.entries(node.events).map(([name, intent]) => [
                node.kind === "textField" && name === "onSubmit" ? "onCommit" : name,
                intent,
              ]),
            ),
          }
        : {}),
      ...(node.children ? { children: node.children.map(convert) } : {}),
    };
  }
  documents[`${name}.tree`] = { ...input, catalogId: catalog.catalogId, root: convert(input.root) };
}
const task = agentHomeFixture.groups.find((g) => g.id === "tasks")?.pages[0]?.rows[0];
const decision = agentHomeFixture.groups[0]?.pages[0]?.rows[0];
ok(task && decision, "Missing queue benchmark fixtures");
function queueData(category: string, row: QueueItem) {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    ...row,
    id: `${category === "tasks" ? "task" : "decision"}-${i}`,
    title: `Synthetic ${category === "tasks" ? "task" : "decision"} ${i}`,
  }));
  return {
    ...agentHomeFixture,
    groups: agentHomeFixture.groups.map((group) => ({
      ...group,
      total: group.id === category ? 50 : 0,
      pages: [{ cursor: "start", rows: group.id === category ? rows : [] }],
    })),
  };
}
tree(
  "agent-home",
  render(
    AgentHomeQueue,
    {
      params: queueParams,
      state: { ...initialQueueState, selected: "task-0" },
      data: queueData("tasks", task),
      context: { size: "full" },
    },
    agentHomeOptions,
  ),
);
for (const size of ["small", "medium", "large", "full"])
  tree(
    `core-queue.${size}`,
    render(
      CoreQueue,
      {
        params: queueParams,
        state: { ...initialQueueState, selected: "decision-0" },
        data: queueData("decisions", decision),
        context: { size },
      },
      coreQueueOptions,
    ),
  );
const root = gitFixture.statuses[0];
ok(root, "Missing git benchmark fixture");
tree(
  "git-status",
  render(
    GitStatus,
    {
      params: {},
      state: {},
      data: { statuses: Array.from({ length: 13 }, (_, i) => ({ ...root, workspaceRootId: `root-${i}` })) },
      context: { size: "full" },
    },
    gitOptions,
  ),
);
tree(
  "rack-module",
  render(
    RackModule,
    {
      params: {},
      state: { ...initialRackState, tab: "files", draft: "Draft 0" },
      data: {
        ...rackFixture,
        files: Array.from({ length: 50 }, (_, i) => ({ name: `File-${i}.tsx`, status: "M", operation: "written" })),
      },
      context: { size: "full" },
    },
    rackOptions,
  ),
);
const validateTree = new Ajv2020({ strict: true }).compile(schemaDocument("ui-tree"));
for (const [name, doc] of Object.entries(documents))
  if (name.endsWith(".tree")) ok(validateTree(doc), `${name}: ${JSON.stringify(validateTree.errors)}`);
for (const [name, doc] of Object.entries(documents))
  await Bun.write(resolve(out, `${name}.json`), `${JSON.stringify(doc, null, 2)}\n`);
ok(performance.now() - start < 30_000, "Export exceeded 30 seconds");
console.log(`Exported ${Object.keys(documents).length} proof fixtures in ${(performance.now() - start).toFixed(0)} ms`);
