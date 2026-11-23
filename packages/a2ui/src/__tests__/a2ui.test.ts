// fromA2ui (design 039 A.1–A.10): conversion through the starter catalog, every refused construct, bounds.
import { describe, expect, test } from "bun:test";
import { compileValidator, type Json, type LiveframeError, obj, str, validateCapabilities } from "@arnilo/liveframe";
import { ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";
import { catalog } from "@arnilo/liveframe-starter";
import { type A2uiMapping, fromA2ui } from "../index.ts";

const BASIC = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
const capabilities = (() => {
  const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
  const checked = validateCapabilities({
    format: "liveframe-capabilities/1",
    sources: {},
    actions: {
      "tasks.claim": {
        description: "Claim a task.",
        args: { ...empty, properties: { id: { type: "string", maxLength: 64 } }, required: ["id"] },
      },
      "tasks.search": {
        description: "Search tasks.",
        args: { ...empty, properties: { q: { type: "string", maxLength: 80 } }, required: ["q"] },
      },
      "tasks.other": { description: "Not offered to the agent.", args: empty },
    },
  });
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  return checked.value;
})();

/** The README's worked mapping for the starter catalog. */
const mapping: A2uiMapping = {
  catalogId: BASIC,
  components: {
    Column: { kind: "stack" },
    Row: { kind: "inline" },
    List: { kind: "stack" },
    Card: { kind: "box", variants: { default: "plate" } },
    Divider: { kind: "separator" },
    Text: { kind: "text", props: { text: "text" }, variants: { body: "default", caption: "default" } },
    Image: { kind: "image", props: { url: "src", "accessibility.label": "alt" } },
    Button: {
      kind: "button",
      lift: { child: "label" },
      variants: { default: "default", primary: "primary", borderless: "ghost" },
      event: "onPress",
    },
    TextField: {
      kind: "textField",
      props: { label: "label", value: "value" },
      input: { prop: "value", event: "onChange" },
    },
    CheckBox: {
      kind: "checkbox",
      props: { label: "label", value: "checked" },
      input: { prop: "checked", event: "onChange" },
    },
    Tabs: {
      kind: "tabs",
      props: { "accessibility.label": "label" },
      items: { tabs: { kind: "tab", props: { title: "label" }, child: "child", index: "value" } },
    },
  },
  actions: { claim: "tasks.claim", search: "tasks.search", other: "tasks.other" },
  local: { "/filter": "q" },
};

const local = obj({ q: str({ maxLength: 80 }) });
function validator(actions: readonly string[] = ["tasks.claim", "tasks.search"]) {
  return compileValidator({
    catalog,
    capabilities,
    manifest: ephemeralManifest({ catalogId: catalog.catalogId, actions, local, initialLocal: { q: "" } }),
  });
}
const renderOptions = { validator: validator(), surfaceId: "agent", revision: 0 };

const create = { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId: BASIC } };
const components = (list: unknown[]) => ({
  version: "v0.9.1",
  updateComponents: { surfaceId: "main", components: list },
});
const data = (value: unknown, path?: string) => ({
  version: "v0.9.1",
  updateDataModel: { surfaceId: "main", ...(path === undefined ? {} : { path }), value },
});
const surface = (list: unknown[], model?: unknown) => [
  create,
  components(list),
  ...(model === undefined ? [] : [data(model)]),
];
const jsonl = (messages: unknown[]) => messages.map((m) => JSON.stringify(m)).join("\n");

function convert(messages: string | unknown[], m: A2uiMapping = mapping) {
  const result = fromA2ui(messages, m);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
function failures(messages: string | unknown[], m: A2uiMapping = mapping): [string, string][] {
  const result = fromA2ui(messages, m);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors.map((e: LiveframeError) => [e.kind, e.pointer]);
}

const taskList = [
  { id: "root", component: "Column", children: ["title", "filter", "rows"] },
  // biome-ignore lint/suspicious/noTemplateCurlyInString: A2UI interpolation, not a template literal
  { id: "title", component: "Text", text: { call: "formatString", args: { value: "Tasks for ${/user/name}" } } },
  { id: "filter", component: "TextField", label: "Filter", value: { path: "/filter" } },
  { id: "rows", component: "List", children: { componentId: "row", path: "/tasks" } },
  { id: "row", component: "Row", children: ["row-text", "row-claim"] },
  { id: "row-text", component: "Text", text: { path: "title" }, variant: "body" },
  {
    id: "row-claim",
    component: "Button",
    child: "claim-label",
    variant: "primary",
    action: { event: { name: "claim", context: { id: "t" } } },
  },
  { id: "claim-label", component: "Text", text: "Claim" },
];
const taskModel = { user: { name: "Ada" }, filter: "re", tasks: [{ title: "Write the report" }, { title: "Review" }] };

describe("conversion", () => {
  test("a2ui_document_converts_and_renders_through_the_starter_catalog", () => {
    const { elements, initialLocal } = convert(jsonl(surface(taskList, taskModel)));
    expect(initialLocal).toEqual({ q: "re" });
    const rendered = renderElements(elements, renderOptions);
    if (!rendered.ok) throw new Error(JSON.stringify(rendered.errors));
    const root = rendered.value.root;
    expect(root.kind).toBe("stack");
    expect(root.children?.map((child) => child.kind)).toEqual(["text", "textField", "stack"]);
    expect(root.children?.[0]?.props).toEqual({ text: "Tasks for Ada" });
    const rows = root.children?.[2]?.children ?? [];
    expect(rows.map((row) => row.children?.[0]?.props.text)).toEqual(["Write the report", "Review"]);
    expect(rows[0]?.children?.[1]).toMatchObject({
      kind: "button",
      variant: "primary",
      props: { label: "Claim" },
      events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t" } } },
    });
  });

  test("a2ui_template_children_expand_with_stable_keys", () => {
    const first = convert(surface(taskList, taskModel)).elements as { children: { children: { key: string }[] }[] };
    expect(first.children[2]?.children.map((row) => row.key)).toEqual(["row-0", "row-1"]);
    const again = convert(surface(taskList, taskModel));
    expect(again.elements).toEqual(first as unknown as Json);
    const a = renderElements(first as unknown as Json, renderOptions);
    const b = renderElements(again.elements, renderOptions);
    if (!a.ok || !b.ok) throw new Error("render failed");
    expect(a.value.root.children?.[2]?.children?.map((row) => row.id)).toEqual(
      b.value.root.children?.[2]?.children?.map((row) => row.id),
    );
  });

  test("a2ui_input_with_a_mapped_path_becomes_a_local_binding", () => {
    const { elements, initialLocal } = convert(surface(taskList, taskModel));
    const filter = (elements as { children: Json[] }).children[1];
    expect(filter).toEqual({
      kind: "textField",
      key: "filter",
      props: { label: "Filter", value: "re" },
      events: { onChange: { type: "setLocal", key: "q" } },
      bind: { value: { $path: "local.q" } },
    });
    expect(initialLocal).toEqual({ q: "re" });
    // Without a local entry the input carries only its initial value.
    const unbound = convert(surface(taskList, taskModel), { ...mapping, local: {} });
    expect((unbound.elements as { children: Json[] }).children[1]).toEqual({
      kind: "textField",
      key: "filter",
      props: { label: "Filter", value: "re" },
    });
    expect(unbound.initialLocal).toEqual({});
  });

  test("context_path_mapped_to_local_becomes_from_local", () => {
    const list = [
      { id: "root", component: "Column", children: ["filter", "go"] },
      { id: "filter", component: "TextField", label: "Search", value: { path: "/filter" } },
      {
        id: "go",
        component: "Button",
        child: "go-label",
        action: { event: { name: "search", context: { q: { path: "/filter" } } } },
      },
      { id: "go-label", component: "Text", text: "Search" },
    ];
    const { elements } = convert(surface(list, { filter: "" }));
    expect((elements as { children: Json[] }).children[1]).toMatchObject({
      events: { onPress: { type: "action", name: "tasks.search", args: {}, fromLocal: { q: "q" } } },
    });
    expect(renderElements(elements, renderOptions).ok).toBe(true);
  });

  test("tabs_items_become_tab_elements_with_their_children", () => {
    const list = [
      {
        id: "root",
        component: "Tabs",
        accessibility: { label: "Views" },
        tabs: [
          { title: "Open", child: "open" },
          { title: "Done", child: "done" },
        ],
      },
      { id: "open", component: "Text", text: "Open tasks" },
      { id: "done", component: "Text", text: "Done tasks" },
    ];
    const { elements } = convert(surface(list));
    expect(elements).toEqual({
      kind: "tabs",
      key: "root",
      props: { label: "Views" },
      children: [
        {
          kind: "tab",
          key: "root-tabs-0",
          props: { label: "Open", value: "0" },
          children: [{ kind: "text", key: "open", props: { text: "Open tasks" } }],
        },
        {
          kind: "tab",
          key: "root-tabs-1",
          props: { label: "Done", value: "1" },
          children: [{ kind: "text", key: "done", props: { text: "Done tasks" } }],
        },
      ],
    });
    expect(renderElements(elements, renderOptions).ok).toBe(true);
  });

  test("later_component_updates_replace_earlier_and_data_updates_apply_in_order", () => {
    const messages = [
      create,
      components([{ id: "root", component: "Text", text: "old" }]),
      components([{ id: "root", component: "Text", text: { path: "/a/b" } }]),
      data({ a: { b: "first" } }),
      data("second", "/a/b"),
      data({ gone: true }, "/c"),
      { version: "v0.9", updateDataModel: { surfaceId: "main", path: "/c" } },
    ];
    expect(convert(messages).elements).toEqual({ kind: "text", key: "root", props: { text: "second" } });
  });
});

describe("refused constructs", () => {
  const text = (extra: Record<string, unknown>) => surface([{ id: "root", component: "Text", text: "x", ...extra }]);
  const button = (action: unknown) =>
    surface([
      { id: "root", component: "Button", child: "l", action },
      { id: "l", component: "Text", text: "Go" },
    ]);
  const cases: [string, unknown[], [string, string][]][] = [
    [
      "function_call",
      text({ text: { call: "now", args: {} } }),
      [["unknown-name", "/1/updateComponents/components/0/text/call"]],
    ],
    [
      "function_inside_format_string",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: A2UI interpolation, not a template literal
      text({ text: { call: "formatString", args: { value: "${now()}" } } }),
      [["unknown-name", "/1/updateComponents/components/0/text/args/value"]],
    ],
    [
      "function_call_action",
      button({ functionCall: { call: "openUrl", args: { url: "https://example.com" } } }),
      [["invalid-document", "/1/updateComponents/components/0/action/functionCall"]],
    ],
    [
      "checks",
      text({ checks: [{ call: "required", args: {} }] }),
      [["unknown-name", "/1/updateComponents/components/0/checks"]],
    ],
    ["weight", text({ weight: 1 }), [["unknown-name", "/1/updateComponents/components/0/weight"]]],
    [
      "theme",
      [
        { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId: BASIC, theme: { primaryColor: "#f00" } } },
        components([{ id: "root", component: "Divider" }]),
      ],
      [["invalid-document", "/0/createSurface/theme"]],
    ],
    [
      "send_data_model",
      [
        { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId: BASIC, sendDataModel: true } },
        components([{ id: "root", component: "Divider" }]),
      ],
      [["invalid-document", "/0/createSurface/sendDataModel"]],
    ],
    [
      "svg_path",
      surface([{ id: "root", component: "Image", url: { svgPath: "M0 0L10 10" } }]),
      [["invalid-document", "/1/updateComponents/components/0/url/svgPath"]],
    ],
    [
      "delete_surface",
      [...text({}), { version: "v0.9.1", deleteSurface: { surfaceId: "main" } }],
      [["invalid-document", "/2/deleteSurface"]],
    ],
    [
      "two_surfaces",
      [...text({}), { version: "v0.9.1", updateComponents: { surfaceId: "other", components: [] } }],
      [["invalid-document", "/2/updateComponents/surfaceId"]],
    ],
    [
      "shared_component",
      surface([
        { id: "root", component: "Column", children: ["a", "a"] },
        { id: "a", component: "Divider" },
      ]),
      [["invalid-document", "/1/updateComponents/components/0/children/1"]],
    ],
    [
      "cycle",
      surface([
        { id: "root", component: "Column", children: ["a"] },
        { id: "a", component: "Column", children: ["root"] },
      ]),
      [["invalid-document", "/1/updateComponents/components/1/children/0"]],
    ],
    [
      "unreachable_component",
      surface([
        { id: "root", component: "Divider" },
        { id: "stray", component: "Divider" },
      ]),
      [["invalid-document", "/1/updateComponents/components/1"]],
    ],
    [
      "unsupported_version",
      [{ ...create, version: "v0.8" }, components([{ id: "root", component: "Divider" }])],
      [
        ["invalid-document", "/0/version"],
        ["invalid-document", "/"],
      ],
    ],
    [
      "context_path_without_local",
      button({ event: { name: "claim", context: { id: { path: "/task/id" } } } }),
      [["unknown-name", "/1/updateComponents/components/0/action/event/context/id"]],
    ],
    [
      "unmapped_event",
      button({ event: { name: "delete" } }),
      [["unknown-name", "/1/updateComponents/components/0/action/event/name"]],
    ],
    ["unmapped_property", text({ align: "center" }), [["unknown-name", "/1/updateComponents/components/0/align"]]],
    ["unmapped_variant", text({ variant: "h1" }), [["unknown-name", "/1/updateComponents/components/0/variant"]]],
    [
      "unresolved_path",
      text({ text: { path: "/missing" } }),
      [["not-found", "/1/updateComponents/components/0/text/path"]],
    ],
    [
      "other_catalog",
      [
        { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId: "https://example.com/c.json" } },
        components([{ id: "root", component: "Divider" }]),
      ],
      [["invalid-document", "/0/createSurface/catalogId"]],
    ],
    ["no_root", surface([{ id: "top", component: "Divider" }]), [["not-found", "/"]]],
  ];
  for (const [name, messages, expected] of cases)
    test(`refuses_${name}`, () => {
      expect(failures(messages)).toEqual(expected);
    });

  test("unmapped_component_is_a_typed_error_with_its_pointer", () => {
    const messages = surface([
      { id: "root", component: "Column", children: ["v"] },
      { id: "v", component: "Video", url: "https://example.com/v.mp4" },
    ]);
    const result = fromA2ui(jsonl(messages), mapping);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({ kind: "unknown-component", pointer: "/1/updateComponents/components/1/component" }),
    ]);
  });

  test("dropped_constructs_are_only_those_named", () => {
    const withAll = [
      { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId: BASIC, theme: { primaryColor: "#f00" } } },
      components([{ id: "root", component: "TextField", label: "Name", value: "", weight: 1, checks: [] }]),
    ];
    expect(failures(withAll, { ...mapping, drop: ["theme"] })).toEqual([
      ["unknown-name", "/1/updateComponents/components/0/weight"],
      ["unknown-name", "/1/updateComponents/components/0/checks"],
    ]);
    expect(convert(withAll, { ...mapping, drop: ["theme", "weight", "checks"] }).elements).toEqual({
      kind: "textField",
      key: "root",
      props: { label: "Name", value: "" },
    });
  });
});

describe("validation stays the core's", () => {
  test("converted_action_must_be_declared_by_the_manifest", () => {
    const list = [
      { id: "root", component: "Button", child: "l", action: { event: { name: "other" } } },
      { id: "l", component: "Text", text: "Go" },
    ];
    const { elements } = convert(surface(list));
    const rendered = renderElements(elements, renderOptions);
    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.errors).toEqual([
      expect.objectContaining({ kind: "undeclared-action", pointer: "/events/onPress/name" }),
    ]);
  });

  test("origins_map_render_errors_back_to_a2ui", () => {
    const list = [
      { id: "root", component: "Column", children: ["pic"] },
      { id: "pic", component: "Image", url: "javascript:alert(1)", accessibility: { label: "Logo" } },
    ];
    const { elements, origins } = convert(surface(list));
    const rendered = renderElements(elements, renderOptions);
    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    const [error] = rendered.errors;
    expect(error?.pointer).toBe("/children/0/props/src");
    expect(origins[error?.pointer ?? ""]).toBe("/1/updateComponents/components/1/url");
    expect(origins["/children/0"]).toBe("/1/updateComponents/components/1");
    expect(origins["/children/0/props/alt"]).toBe("/1/updateComponents/components/1/accessibility/label");
  });
});

describe("bounds", () => {
  test("sparse_array_index_is_refused", () => {
    const messages = surface([{ id: "root", component: "Text", text: { path: "/items/1" } }], { items: ["first"] });
    expect(convert([...messages, data("second", "/items/1")]).elements).toEqual({
      kind: "text",
      key: "root",
      props: { text: "second" },
    });
    expect(failures([...messages, data("third", "/items/2")])).toEqual([["limit-exceeded", "/3/updateDataModel/path"]]);
  });

  test("data_writes_share_a_value_budget", () => {
    const messages = surface([{ id: "root", component: "Divider" }]);
    const path = "/item".repeat(40);
    const result = fromA2ui([...messages, data(1, path), data(2, path)], mapping, { limits: { nodes: 8 } });
    expect(result).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "/3/updateDataModel/path" }],
    });
  });

  test("formatted_output_is_bounded", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: A2UI interpolation syntax
    const ref = "${/value}";
    const format = (value: string) => ({ call: "formatString", args: { value } });
    const model = { value: "x".repeat(160) };
    const options = { limits: { bytes: 150 } };
    const one = surface([{ id: "root", component: "Text", text: format(ref.repeat(4)) }], model);
    const many = surface(
      [
        { id: "root", component: "Column", children: ["a", "b"] },
        { id: "a", component: "Text", text: format(ref.repeat(3)) },
        { id: "b", component: "Text", text: format(ref) },
      ],
      model,
    );
    for (const [messages, index] of [
      [one, 0],
      [many, 2],
    ] as const) {
      expect(fromA2ui(messages, mapping, options)).toMatchObject({
        ok: false,
        errors: [{ kind: "limit-exceeded", pointer: `/1/updateComponents/components/${index}/text/args/value` }],
      });
    }
  });

  test("formatted_json_charges_escaped_characters", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: A2UI interpolation syntax
    const ref = "${/value}";
    const messages = (value: Json) =>
      surface([{ id: "root", component: "Text", text: { call: "formatString", args: { value: ref } } }], { value });
    const value = { original: ["😀", "\n", "\ud800", "\u0000", null, 42] };
    expect(convert(messages(value)).elements).toMatchObject({ props: { text: JSON.stringify(value) } });
    expect(fromA2ui(messages(["\u0000".repeat(100)]), mapping, { limits: { bytes: 150 } })).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "/1/updateComponents/components/0/text/args/value" }],
    });
  });

  test("deep_pointer_returns_a_typed_error", () => {
    const path = "/item".repeat(129);
    expect(failures([...surface([{ id: "root", component: "Divider" }]), data(1, path)])).toEqual([
      ["limit-exceeded", "/2/updateDataModel/path"],
    ]);
    expect(failures(surface([{ id: "root", component: "Text", text: { path } }]))).toEqual([
      ["limit-exceeded", "/1/updateComponents/components/0/text/path"],
    ]);
  });

  test("unexpected_conversion_errors_are_typed_and_hide_thrown_text", () => {
    for (const [error, kind] of [
      [new RangeError("private"), "limit-exceeded"],
      [new Error("private"), "invalid-document"],
    ]) {
      const message = {
        get version() {
          throw error;
        },
      };
      const result = fromA2ui([message], mapping);
      expect(result).toMatchObject({ ok: false, errors: [{ kind, pointer: "/" }] });
      expect(JSON.stringify(result)).not.toContain("private");
    }
    expect(() => fromA2ui([], { ...mapping, components: null as never })).toThrow(TypeError);
  });

  test("hostile_document_is_bounded_and_yields_no_tree", () => {
    // Deep nesting in the input.
    let deep: unknown = "x";
    for (let i = 0; i < 200; i++) deep = [deep];
    expect(failures(surface([{ id: "root", component: "Text", text: deep }]))).toEqual([["limit-exceeded", "/"]]);
    // A huge string, as text and as parsed messages.
    const huge = "a".repeat(4 * 1024 * 1024 + 1);
    expect(failures(huge)).toEqual([["limit-exceeded", "/"]]);
    expect(failures(surface([{ id: "root", component: "Text", text: huge }]))).toEqual([["limit-exceeded", "/"]]);
    // 10⁶ components.
    const many = Array.from({ length: 1_000_000 }, (_, i) => ({ id: `c${i}`, component: "Divider" }));
    expect(failures(surface(many))).toEqual([["limit-exceeded", "/"]]);
    // A component chain deeper than the element depth limit.
    const chain = Array.from({ length: 80 }, (_, i) => ({
      id: i === 0 ? "root" : `c${i}`,
      component: "Column",
      ...(i < 79 ? { children: [`c${i + 1}`] } : {}),
    }));
    expect(failures(surface(chain))).toEqual([["limit-exceeded", "/1/updateComponents/components/64"]]);
    // A template over more items than the bound.
    const rows = [
      { id: "root", component: "List", children: { componentId: "row", path: "/rows" } },
      { id: "row", component: "Divider" },
    ];
    expect(failures(surface(rows, { rows: Array.from({ length: 1001 }, () => 0) }))).toEqual([
      ["limit-exceeded", "/1/updateComponents/components/0/children/path"],
    ]);
    // Prototype keys in the document reach nothing: no component, action or data path named __proto__ resolves.
    expect(failures(surface([{ id: "root", component: "__proto__" }]))).toEqual([
      ["unknown-component", "/1/updateComponents/components/0/component"],
    ]);
    expect(failures(surface([{ id: "root", component: "Text", text: { path: "/constructor" } }]))).toEqual([
      ["not-found", "/1/updateComponents/components/0/text/path"],
    ]);
    // Script-like values are carried as inert strings; the validator decides what they may be.
    const script = "<script>alert(1)</script><img src=x onerror=alert(1)>";
    const inert = convert(surface([{ id: "root", component: "Text", text: script }]));
    expect(inert.elements).toEqual({ kind: "text", key: "root", props: { text: script } });
    const link = convert(
      surface([{ id: "root", component: "Image", url: "javascript:alert(1)", accessibility: { label: "x" } }]),
    );
    expect(renderElements(link.elements, renderOptions).ok).toBe(false);
  });

  test("malformed_jsonl_line_is_an_error_at_its_message", () => {
    expect(failures(`${JSON.stringify(create)}\n{not json`)).toEqual([
      ["invalid-document", "/1"],
      ["invalid-document", "/1"],
    ]);
  });

  test("conversion_is_linear", () => {
    // Work counted by own-property checks and map lookups, not a timer (plan 033 Task 9).
    function work(rows: number): number {
      const list = [
        { id: "root", component: "Column", children: Array.from({ length: rows }, (_, i) => `r${i}`) },
        ...Array.from({ length: rows }, (_, i) => ({ id: `r${i}`, component: "Text", text: { path: `/t/${i}` } })),
      ];
      const messages = surface(list, { t: Array.from({ length: rows }, (_, i) => `row ${i}`) });
      const hasOwn = Object.hasOwn;
      const get = Map.prototype.get;
      let count = 0;
      Object.hasOwn = (o: object, k: PropertyKey) => {
        count++;
        return hasOwn(o, k);
      };
      Map.prototype.get = function (this: Map<unknown, unknown>, k: unknown) {
        count++;
        return get.call(this, k);
      };
      try {
        expect(fromA2ui(messages, mapping).ok).toBe(true);
      } finally {
        Object.hasOwn = hasOwn;
        Map.prototype.get = get;
      }
      return count;
    }
    const small = work(250);
    const large = work(500);
    expect(large / small).toBeGreaterThan(1.8);
    expect(large / small).toBeLessThan(2.2);
  });
});
