import { harnessActions, harnessInputs, harnessOptions, harnessWidget } from "../widgets/harness.tsx";
import { createSurface } from "./state.ts";

// Tasks 7–9 replace each smoke registration with its reference widget and fixture.
export const pages = {
  "agent-home": "Agent-home queue — reference widget pending Task 7",
  "core-queue": "Core queue — reference widget pending Task 8",
  "git-status": "Git status — reference widget pending Task 9",
  "rack-module": "Rack module — reference widget pending Task 9",
  "design-system": "Design-system switch — reference proof pending Task 10",
} as const;

export function openPage(size: string) {
  return createSurface(harnessWidget, { ...harnessInputs, context: { size } }, harnessOptions, harnessActions);
}
