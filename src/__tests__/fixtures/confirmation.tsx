import { StrictMode } from "react";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import { compileValidator, type Intent, type IntentOrigin } from "../../index.ts";
import { renderer, catalog, surfaceProps, withRoot } from "./react-surface.tsx";
import capabilities from "./proof/capabilities.json" with { type: "json" };
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };

export const confirmationValidator = compileValidator({
  catalog,
  manifest,
  capabilities: {
    ...capabilities,
    actions: {
      ...capabilities.actions,
      "tasks.escalate": { ...capabilities.actions["tasks.escalate"], confirm: true, irreversible: true },
      "tasks.claim": { ...capabilities.actions["tasks.claim"], irreversible: true },
    },
  },
});

export function installConfirmation(root: Root) {
  const { Surface } = renderer();
  const emissions: { intent: Intent; origin: IntentOrigin }[] = [];
  const requests: { intent: Intent; meta: { confirm: boolean; irreversible: boolean } }[] = [];
  let resolve: (value: boolean) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  let mode = "pending";
  let revision = 1;
  const confirm = (intent: Intent, meta: { confirm: boolean; irreversible: boolean }) => {
    requests.push({ intent, meta });
    if (mode === "throw") throw new Error("Confirmation failed");
    return new Promise<boolean>((yes, no) => {
      resolve = yes;
      reject = no;
    });
  };
  function draw(enabled = true) {
    const tree = withRoot({
      id: "root",
      kind: "stack",
      props: {},
      children: [
        {
          id: "root/confirm",
          kind: "button",
          props: { label: "Confirm" },
          events: { onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "review" } } },
        },
        {
          id: "root/direct",
          kind: "button",
          props: { label: "Direct" },
          events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
        },
        {
          id: "root/state",
          kind: "button",
          props: { label: "State" },
          events: { onPress: { type: "setState", key: "reason", value: "changed" } },
        },
      ],
    });
    flushSync(() =>
      root.render(
        <StrictMode>
          <Surface
            {...surfaceProps}
            validator={confirmationValidator}
            tree={{ ...tree, revision }}
            {...(enabled ? { confirm } : {})}
            onIntent={(intent, origin) => emissions.push({ intent, origin })}
          />
        </StrictMode>,
      ),
    );
  }
  window.confirmationTest = {
    mount(enabled = true) {
      draw(enabled);
    },
    requests: () => requests,
    emissions: () => emissions,
    approve(value) {
      resolve(value);
    },
    reject() {
      reject(new Error("Cancelled"));
    },
    throwNext() {
      mode = "throw";
    },
    advance() {
      revision++;
      draw();
    },
    unmount() {
      flushSync(() => root.unmount());
    },
  };
}

declare global {
  interface Window {
    confirmationTest: {
      mount(enabled?: boolean): void;
      requests(): readonly { intent: Intent; meta: { confirm: boolean; irreversible: boolean } }[];
      emissions(): readonly { intent: Intent; origin: IntentOrigin }[];
      approve(value: boolean): void;
      reject(): void;
      throwNext(): void;
      advance(): void;
      unmount(): void;
    };
  }
}
