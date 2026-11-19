// Browser half of the DOM parity test: the same trees through `/react` and through `/dom`.
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createDomRenderer } from "../../dom/index.ts";
import { compileValidator, type Intent, type Json, type UiTree } from "../../index.ts";
import { createRenderer, implement } from "../../react/index.ts";
import { domImplementations, PROPS_ATTRIBUTE } from "./dom-renderer.ts";
import { catalog } from "./react-surface.tsx";
import capabilities from "./widgets/capabilities.json" with { type: "json" };

type Step = { readonly nodeId: string; readonly event: string; readonly value?: string | boolean | number };
type Run = { readonly manifest: unknown; readonly tree: UiTree; readonly steps?: readonly Step[] };
// Children are `unknown` so the type stays shallow for `page.evaluate`'s serialisation types.
type Shape = readonly [string, readonly (readonly [string, string])[], readonly unknown[]];

declare global {
  interface Window {
    parity: {
      run(input: Run): { react: unknown[]; dom: unknown[]; reactIntents: unknown[]; domIntents: unknown[] }[];
    };
    ready: boolean;
  }
}

const emitters = new Map<string, (event: string, value?: never) => unknown>();
const { Surface } = createRenderer({
  catalog,
  implementations: catalog.definitions.map((definition) =>
    implement(definition, (input) => {
      emitters.set(input.domId.slice(input.domId.indexOf(":") + 1), input.emit as never);
      return (
        <div className={input.slot("root")} style={input.style} {...{ [PROPS_ATTRIBUTE]: JSON.stringify(input.props) }}>
          {definition.slots
            .filter((slot) => slot !== "root")
            .map((slot) => (
              <span key={slot} className={input.slot(slot)} />
            ))}
          {input.children}
        </div>
      );
    }),
  ),
});

const domEmitters = new Map<string, (event: string, value?: Json) => Promise<void> | undefined>();
const { mount } = createDomRenderer({ catalog, implementations: domImplementations(catalog, domEmitters) });

/** Element structure with sorted attributes; React's `useId` prefix is replaced so both sides compare equal. */
function shape(element: Element): Shape {
  const attributes = [...element.attributes]
    .map((attribute) => [attribute.name, attribute.value.replace(/lf-[^:"]*:/g, "lf:")] as const)
    .sort(([left], [right]) => (left < right ? -1 : 1));
  return [element.tagName, attributes, [...element.children].map(shape)] as const;
}

const identity = { id: "certified", version: "1.0.0" };

window.parity = {
  run({ manifest, tree, steps = [] }) {
    const validator = compileValidator({ catalog, capabilities, manifest });
    const reactIntents: Intent[] = [];
    const domIntents: Intent[] = [];
    const reactHost = document.createElement("div");
    const domHost = document.createElement("div");
    document.body.append(reactHost, domHost);
    const root = createRoot(reactHost);
    const dom = mount(domHost, {
      validator,
      theme: identity,
      designSystem: identity,
      onIntent: (intent) => domIntents.push(intent),
      fallback: () => Object.assign(document.createElement("p"), { textContent: "Unavailable" }),
    });
    flushSync(() =>
      root.render(
        <Surface
          tree={tree}
          validator={validator}
          theme={identity}
          designSystem={identity}
          diagnostics={[]}
          fallback={<p>Unavailable</p>}
          onIntent={(intent) => reactIntents.push(intent)}
        />,
      ),
    );
    dom.update(tree);
    const snapshots = () => ({
      // Both draw a wrapper for the surface and a sibling portal container; the surface's content is the wrapper's.
      react: [...(reactHost.firstElementChild?.children ?? [])].map(shape),
      dom: [...(domHost.firstElementChild?.children ?? [])].map(shape),
      reactIntents: [...reactIntents],
      domIntents: [...domIntents],
    });
    const outcomes = [snapshots()];
    for (const { nodeId, event, value } of steps) {
      flushSync(() => void emitters.get(nodeId)?.(event, value as never));
      domEmitters.get(nodeId)?.(event, value as never);
      outcomes.push(snapshots());
    }
    root.unmount();
    dom.dispose();
    reactHost.remove();
    domHost.remove();
    return outcomes;
  },
};
window.ready = true;
