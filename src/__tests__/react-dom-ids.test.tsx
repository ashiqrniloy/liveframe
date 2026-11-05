import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import type { ImplementationProps } from "../react/index.ts";
import { renderer, surfaceProps, withRoot } from "./fixtures/react-surface.tsx";

const tree = withRoot({
  id: "root",
  kind: "stack",
  props: {},
  children: [
    { id: "root/field", kind: "textField", props: { label: "Reason", describedBy: "root/hint" } },
    { id: "root/hint", kind: "hint", props: { text: "At most 200 characters" } },
    { id: "root/plain", kind: "textField", props: { label: "Plain" } },
  ],
});

function observed(surfaces: number) {
  const seen = new Map<string, ImplementationProps>();
  const { Surface } = renderer((kind, input) => {
    if (kind === "textField" || kind === "hint")
      seen.set(`${kind}:${String(input.props.label ?? input.props.text)}`, input);
  });
  const html = renderToString(
    <div>
      {Array.from({ length: surfaces }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: The surfaces are identical and never reorder.
        <Surface key={index} tree={tree} {...surfaceProps} />
      ))}
    </div>,
  );
  return { seen, html };
}

test("ref_prop_value_becomes_the_targets_dom_id", () => {
  const { seen } = observed(1);
  const field = seen.get("textField:Reason");
  const hint = seen.get("hint:At most 200 characters");
  expect(hint?.domId).toBeString();
  expect(hint?.domId.endsWith(":root/hint")).toBe(true);
  expect(field?.props.describedBy).toBe(hint?.domId);
  expect(field?.domId).not.toBe(hint?.domId);
  // Props that are not references are untouched, and a node without the reference stays without it.
  expect(field?.props.label).toBe("Reason");
  expect(seen.get("textField:Plain")?.props).toEqual({ label: "Plain" });
});

test("dom_ids_unique_across_two_surfaces", () => {
  const ids: string[] = [];
  const { Surface } = renderer((kind, input) => {
    if (kind === "hint") ids.push(input.domId);
  });
  renderToString(
    <>
      <Surface tree={tree} {...surfaceProps} />
      <Surface tree={tree} {...surfaceProps} />
    </>,
  );
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
});

test("dom_ids_are_valid_in_an_id_list", () => {
  const ids = [...observed(1).seen.values()].map((input) => input.domId);
  // aria-describedby is a space-separated id list, so an id may hold no whitespace.
  for (const id of ids) expect(id).toMatch(/^\S+$/);
});
