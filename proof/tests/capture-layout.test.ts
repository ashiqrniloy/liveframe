import { afterAll, beforeAll, expect, test } from "bun:test";
import { capture, playwrightBackend, type CellLayout } from "@arnilo/liveframe/preview/capture";
import * as playwright from "playwright";

const axes = { scenarios: ["s"], widths: [360], themes: ["light"], designSystems: ["plain"] };
const page = (body: string) => `<!doctype html><html><body style="margin:0">
<div data-lf-ready data-lf-preview='${JSON.stringify(axes)}'>
<div data-lf-cell='{"scenario":"s","width":360,"theme":"light","designSystem":"plain"}' style="width:360px">${body}</div>
</div></body></html>`;
const contents = (id: string, inner: string) => `<div data-lf-node="${id}" style="display:contents">${inner}</div>`;
const box = (width: number, height: number) => `<div style="width:${width}px;height:${height}px"></div>`;

let server: ReturnType<typeof Bun.serve>;
let body = "";
beforeAll(() => {
  server = Bun.serve({ port: 0, fetch: () => new Response(page(body), { headers: { "Content-Type": "text/html" } }) });
});
afterAll(() => server.stop(true));

async function measure(html: string): Promise<CellLayout> {
  body = html;
  const result = await capture(String(server.url), { backend: playwrightBackend(playwright), layout: true });
  const file = result.index.cells[0]?.layout;
  if (!file) throw new Error("No layout file");
  return JSON.parse(new TextDecoder().decode(result.files.get(file)));
}

test("layout_boxes_union_wrapper_children", async () => {
  const layout = await measure(contents("pair", box(100, 20) + box(50, 30)));
  expect(layout.width).toBe(360);
  expect(layout.nodes).toEqual([{ id: "pair", x: 0, y: 0, width: 100, height: 50 }]);
  expect(layout).toMatchObject({ overflowX: false, overflowing: [] });
});

test("layout_nested_contents_wrappers", async () => {
  const layout = await measure(box(10, 15) + contents("outer", contents("inner", box(80, 10))));
  expect(layout.nodes).toEqual([
    { id: "outer", x: 0, y: 15, width: 80, height: 10 },
    { id: "inner", x: 0, y: 15, width: 80, height: 10 },
  ]);
});

test("layout_reports_boxless_nodes", async () => {
  const layout = await measure(
    contents("hidden", '<div style="display:none"></div>') + contents("empty", "") + contents("shown", box(20, 20)),
  );
  const zero = { x: 0, y: 0, width: 0, height: 0 };
  expect(layout.nodes).toEqual([
    { id: "hidden", ...zero },
    { id: "empty", ...zero },
    { id: "shown", x: 0, y: 0, width: 20, height: 20 },
  ]);
});

test("layout_flags_overflowing_row", async () => {
  const layout = await measure(contents("fits", box(100, 10)) + contents("wide", box(500, 10)));
  expect(layout.overflowX).toBe(true);
  expect(layout.overflowing).toEqual(["wide"]);
  expect(layout.nodes.map((node) => node.id)).toEqual(["fits", "wide"]);
});
