import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import type { UiTree } from "../index.ts";
import agentHome from "./fixtures/proof/agent-home.tree.json" with { type: "json" };
import { hydrationTree, renderer, surfaceProps } from "./fixtures/react-surface.tsx";

test("server_renders_fallback_for_invalid_tree", () => {
  let calls = 0;
  const { Surface } = renderer(() => calls++);
  const html = renderToString(<Surface {...surfaceProps} tree={hydrationTree("invalid")} />);
  expect(html).toContain("<p>Unavailable</p>");
  expect(html).not.toContain("Hydrated");
  expect(calls).toBe(0);
});

test("ssr_throw_path_is_specified", () => {
  const { Surface } = renderer();
  expect(() => renderToString(<Surface {...surfaceProps} tree={hydrationTree("throw")} />)).toThrow("Broken primitive");
  let html: string;
  try {
    html = renderToString(<Surface {...surfaceProps} tree={hydrationTree("throw")} />);
  } catch {
    html = renderToString(surfaceProps.fallback);
  }
  expect(html).toBe("<p>Unavailable</p>");
});

test("server_portal_is_undefined_and_overlay_waits_for_mount", () => {
  const portals: unknown[] = [];
  const { Surface } = renderer((_kind, input) => portals.push(input.portal));
  const html = renderToString(<Surface {...surfaceProps} tree={hydrationTree("valid")} />);
  expect(portals.length).toBeGreaterThan(0);
  expect(portals.every((portal) => portal === undefined)).toBe(true);
  expect(html).toContain("Hydrated");
  expect(html).not.toContain('role="dialog"');
  expect(html).not.toContain("Overlay content");
  expect(html).toContain('data-lf-portal=""></div>');
});

test("agent_home_server_render_time_is_recorded", () => {
  const { Surface } = renderer();
  const start = performance.now();
  const html = renderToString(<Surface {...surfaceProps} tree={agentHome as UiTree} />);
  console.log(`Agent-home SSR (test-local implementations): ${(performance.now() - start).toFixed(2)} ms`);
  expect(html).toContain("lf_stack_default_root");
  expect(html).not.toContain("Unavailable");
});
