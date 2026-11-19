// Browser half of `conformance-dom-browser.test.ts`: the app-owned page for `/conformance/dom`.
import { domConformancePage } from "../../conformance/dom/index.ts";
import { domImplementations, domPageOptions, forwarded } from "./conformance-dom.ts";

const compoundAction = "tasks.claim";
const fromLocalAction = "tasks.escalate";
const mode = new URL(location.href).searchParams.get("mutant") ?? "";
const page = domConformancePage({ ...domPageOptions, implementations: domImplementations(mode) });
const emissions = page.emissions;
// Broken pages: each changes what the host channel receives, or what the page draws, as a renderer with that
// defect would.
if (mode === "forward-local") page.emissions = () => [...emissions(), ...structuredClone(forwarded)] as never;
if (mode === "post-local")
  page.emissions = () =>
    emissions().map((e) =>
      e.intent.type === "action" && e.intent.name === compoundAction
        ? { ...e, intent: { ...e.intent, local: [{ key: "open", value: true }] } }
        : e,
    );
if (mode === "unfilled")
  page.emissions = () =>
    emissions().map((e) =>
      e.intent.type === "action" && e.intent.name === fromLocalAction
        ? { ...e, intent: { ...e.intent, args: { id: "t1" }, fromLocal: { reason: "title" } } }
        : e,
    );
if (mode === "ignore-keep-last") {
  const mount = page.mount;
  page.mount = (input, styles) => mount(input, styles);
}
