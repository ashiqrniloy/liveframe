import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { UiTree } from "../../index.ts";
import { renderer, surfaceProps, tree, validator } from "./react-surface.tsx";

const { Surface } = renderer();
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
  flushSync(() => root.render(<Surface {...surfaceProps} validator={currentValidator} tree={input} />));
}
declare global {
  interface Window {
    surfaceTest: {
      update(value: unknown): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
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
  tree,
};
draw();
