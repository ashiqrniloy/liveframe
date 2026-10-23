import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Intent, UiTree } from "../../index.ts";
import type { ImplementationProps } from "../../react/index.ts";
import { renderer, surfaceProps, tree, validator } from "./react-surface.tsx";

let button: ImplementationProps | undefined;
const { Surface } = renderer((kind, props) => {
  if (kind === "button") button = props;
});
let intents: Intent[] = [];
let onIntent = intents.push.bind(intents);
const container = document.getElementById("app");
if (!container) throw new Error("Missing app");
const root = createRoot(container, { onCaughtError: () => {} });
let checks = 0;
const checkedValidator = {
  ...validator,
  validateTree: (...args: Parameters<typeof validator.validateTree>) => {
    checks++;
    return validator.validateTree(...args);
  },
};
let input: unknown = tree();
let currentValidator = checkedValidator;
function draw() {
  flushSync(() =>
    root.render(<Surface {...surfaceProps} validator={currentValidator} tree={input} onIntent={onIntent} />),
  );
}
declare global {
  interface Window {
    surfaceTest: {
      update(value: unknown): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
      intents(): readonly Intent[];
      emit(): void;
      replaceIntentHandler(): void;
      tree(revision?: number, surfaceId?: string): UiTree;
    };
  }
}
window.surfaceTest = {
  update(value) {
    input = value;
    draw();
  },
  redraw: draw,
  replaceValidator() {
    currentValidator = { ...checkedValidator };
    draw();
  },
  checks: () => checks,
  intents: () => intents,
  emit: () => button?.emit("onPress"),
  replaceIntentHandler() {
    intents = [];
    onIntent = intents.push.bind(intents);
    draw();
  },
  tree,
};
draw();
