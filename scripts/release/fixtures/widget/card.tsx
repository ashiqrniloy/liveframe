/** @jsxImportSource @arnilo/liveframe/sdk */
import { primitive } from "@arnilo/liveframe/sdk";
import { jsxDEV } from "@arnilo/liveframe/sdk/jsx-dev-runtime";

export const marker = "DraftOnlyMarkerGate2f";

/** A composed component in a second file: the loader must link it like production does. */
export function Card({ title, children }: { title: string; children?: unknown }) {
  return jsxDEV(primitive("stack"), {
    gap: "space.2",
    children: [jsxDEV(primitive("heading"), { text: title, level: 2 }, "title"), children],
  });
}
