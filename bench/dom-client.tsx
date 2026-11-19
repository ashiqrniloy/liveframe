// Browser half of `dom.bench.ts`: the same trees through `/react` and `/dom`, whose implementations draw the same
// elements (the parity fixture's generic structure), timed around each synchronous mount and update.
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { domImplementations, PROPS_ATTRIBUTE } from "../src/__tests__/fixtures/dom-renderer.ts";
import { catalog } from "../src/__tests__/fixtures/react-surface.tsx";
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { createDomRenderer } from "../src/dom/index.ts";
import { compileValidator, type UiTree } from "../src/index.ts";
import { createRenderer, implement } from "../src/react/index.ts";

const identity = { id: "certified", version: "1.0.0" };
const { Surface } = createRenderer({
  catalog,
  implementations: catalog.definitions.map((definition) =>
    implement(definition, (input) => (
      <div className={input.slot("root")} style={input.style} {...{ [PROPS_ATTRIBUTE]: JSON.stringify(input.props) }}>
        {definition.slots
          .filter((slot) => slot !== "root")
          .map((slot) => (
            <span key={slot} className={input.slot(slot)} />
          ))}
        {input.children}
      </div>
    )),
  ),
});
const { mount } = createDomRenderer({ catalog, implementations: domImplementations(catalog) });

type Timings = { readonly mountMs: number[]; readonly patchMs: number[] };

/**
 * Mounts `trees[0]` on a fresh surface `runs` times, then applies the rest one revision at a time. A run's patch
 * sample is the mean over its revisions, timed as one span: one patch is below the coarse timers of WebKit and
 * Firefox (1 ms).
 */
function measure(adapter: "react" | "dom", manifest: unknown, trees: readonly UiTree[], runs: number): Timings {
  const validator = compileValidator({ catalog, capabilities, manifest });
  const mountMs: number[] = [];
  const patchMs: number[] = [];
  const [first, ...rest] = trees as [UiTree, ...UiTree[]];
  for (let run = 0; run < runs; run++) {
    const host = document.createElement("div");
    document.body.append(host);
    if (adapter === "react") {
      const root = createRoot(host);
      const draw = (tree: UiTree) =>
        flushSync(() =>
          root.render(
            <Surface
              tree={tree}
              validator={validator}
              theme={identity}
              designSystem={identity}
              diagnostics={[]}
              fallback={<p>Unavailable</p>}
              onIntent={() => {}}
            />,
          ),
        );
      let started = performance.now();
      draw(first);
      mountMs.push(performance.now() - started);
      started = performance.now();
      for (const tree of rest) draw(tree);
      patchMs.push((performance.now() - started) / rest.length);
      root.unmount();
    } else {
      let started = performance.now();
      const surface = mount(host, {
        validator,
        theme: identity,
        designSystem: identity,
        onIntent: () => {},
        fallback: () => Object.assign(document.createElement("p"), { textContent: "Unavailable" }),
      });
      surface.update(first);
      mountMs.push(performance.now() - started);
      started = performance.now();
      for (const tree of rest) surface.update(tree);
      patchMs.push((performance.now() - started) / rest.length);
      surface.dispose();
    }
    host.remove();
  }
  return { mountMs, patchMs };
}

declare global {
  interface Window {
    domBench: {
      production: boolean;
      measure(adapter: "react" | "dom", manifestJson: string, treesJson: string, runs: number): Timings;
    };
  }
}

window.domBench = {
  production: process.env.NODE_ENV === "production",
  measure: (adapter, manifestJson, treesJson, runs) =>
    measure(adapter, JSON.parse(manifestJson), JSON.parse(treesJson), runs),
};
