import { conformancePage } from "../../conformance/react/index.ts";
import { compoundAction, forwarded, fromLocalAction, implementations, pageOptions } from "./conformance-browser.tsx";

const mode = new URL(location.href).searchParams.get("mutant") ?? "";
const page = conformancePage({ ...pageOptions, implementations: implementations(mode) });
const emissions = page.emissions;
// Broken pages: each changes what the host channel receives, as a renderer with that defect would.
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
