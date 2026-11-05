/** Regenerate: timeout 180s bun --conditions liveframe:source plans/evidence/027-node-reference-cost.ts */
import { strict as assert } from "node:assert";
import { loadavg } from "node:os";
import { toElements } from "../../scripts/fixtures/elements.ts";
import { countNodes, renderWorkloads } from "../../src/__tests__/fixtures/render-workloads.ts";
import { compileValidator, type UiNode } from "../../src/index.ts";
import { Element } from "../../src/sdk/element.ts";
import { render, ref } from "../../src/sdk/index.ts";
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";
import catalog from "../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };

const workload = renderWorkloads().find((entry) => entry.name === "agent-home");
const fixture = proofWidgets.find((entry) => entry.name === "agent-home");
assert(workload && fixture);
const tree = workload.run(0);
assert.equal(countNodes(tree.root), 679);
const referenceCatalog = {
  ...catalog,
  definitions: catalog.definitions.map((d) =>
    d.kind === "text"
      ? {
          ...d,
          refProps: ["describedBy"],
          props: {
            ...d.props,
            properties: { ...d.props.properties, describedBy: { type: "string", maxLength: 1024 } },
          },
        }
      : d,
  ),
};
const validator = compileValidator({ catalog: referenceCatalog, capabilities, manifest: fixture.manifest });
const plainCatalog = {
  ...referenceCatalog,
  definitions: referenceCatalog.definitions.map(({ refProps: _refs, ...d }) => d),
};
const plainValidator = compileValidator({ catalog: plainCatalog, capabilities, manifest: fixture.manifest });
let references = 0;
function referenceTree(node: UiNode): UiNode {
  let props = node.props;
  if (node.kind === "text" && references < 50) {
    references++;
    props = { ...node.props, describedBy: "root" };
  }
  return { ...node, props, ...(node.children ? { children: node.children.map(referenceTree) } : {}) };
}
const withRefs = { ...tree, root: referenceTree(tree.root) };
assert.equal(references, 50);
assert(validator.validateTree(withRefs).ok);

function element(value: Record<string, unknown>, markers: boolean, root = false): Element {
  const { kind, key, children, props, style, events, ...attributes } = value;
  const authored = { ...(props as object), ...(style as object), ...(events as object), ...attributes };
  if (markers && typeof authored.describedBy === "string") authored.describedBy = ref("target");
  if (markers && root) authored.$anchor = "target";
  if (Array.isArray(children)) authored.children = children.map((child) => element(child, markers));
  return new Element(Object.freeze({ kind }), authored, key, true);
}
const plainElement = element(toElements(withRefs.root), false);
const referenceElement = element(toElements(withRefs.root), true, true);
const inputs = fixture.scenarios[0];
assert(inputs);
const options = { validator, surfaceId: tree.surfaceId, revision: tree.revision };
const renderPlain = () => render(() => plainElement, inputs, { ...options, validator: plainValidator });
const renderRefs = () => render(() => referenceElement, inputs, options);
assert.deepEqual(renderRefs(), { ok: true, value: withRefs });
assert(renderPlain().ok);

function sample(run: () => unknown): number {
  const start = performance.now();
  for (let i = 0; i < 300; i++) run();
  return (performance.now() - start) / 300;
}
function pair(name: string, plain: () => unknown, refs: () => unknown): void {
  for (let i = 0; i < 300; i++) {
    plain();
    refs();
  }
  const ratios: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < 15; i++) {
    let before: number;
    let after: number;
    if (i % 2) {
      after = sample(refs);
      before = sample(plain);
    } else {
      before = sample(plain);
      after = sample(refs);
    }
    a.push(before);
    b.push(after);
    ratios.push(after / before);
  }
  const median = (values: number[]) => values.sort((x, y) => x - y)[Math.floor(values.length / 2)] as number;
  const growth = (median(ratios) - 1) * 100;
  console.log(
    `${name}: without refs ${median(a).toFixed(4)} ms; 50 refs ${median(b).toFixed(4)} ms; paired median ${growth.toFixed(2)}%`,
  );
  assert(growth <= 2, `${name}: reference cost exceeds 2%`);
}
console.log(
  `Bun ${Bun.version}; load ${loadavg().join(", ")}; 679 nodes, 50 references, 15 alternating pairs × 300 runs`,
);
console.log(
  "Both arms carry the same 50 wire string props; baseline treats them as ordinary strings. Reference arm enables refProps and markers.",
);
console.log(
  "Emission uses prebuilt elements to isolate the shared render walk; input checks remain included. Compile/setup excluded.",
);
pair(
  "validateTree",
  () => plainValidator.validateTree(withRefs),
  () => validator.validateTree(withRefs),
);
pair("render", renderPlain, renderRefs);
