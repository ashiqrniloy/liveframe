# Liveframe

[![CI](https://github.com/ashiqrniloy/liveframe/actions/workflows/ci.yml/badge.svg)](https://github.com/ashiqrniloy/liveframe/actions/workflows/ci.yml)

Runtime-composable UI for apps: people and AI agents install TSX widgets at runtime and the app's UI changes, with no deployment.

An app ships a small set of trusted **primitive components** and a **design system**. Widgets are ordinary TSX written against those primitives. Widget code runs on the app's backend; the browser only draws a validated tree with the app's own components, so the UI looks native and no widget code runs in the page.

Four rules, none of them optional:

1. Widget code never runs in the browser. Only the app's compiled primitives run there.
2. The UI tree is data, and it is validated before the renderer reads it.
3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.
4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.

[Specification](docs/spec.md) · [How a surface is built](docs/model.md) · [Security model](docs/security.md) · [Compatibility](docs/compatibility.md) · [Changelog](CHANGELOG.md)

## Install

```bash
bun add @arnilo/liveframe
```

Each peer is optional and only the subpaths that need it use it:

| Peer | Range | Needed by |
|---|---|---|
| `react`, `react-dom` | `^19.0.0` | `/react`, `/preview/react`, `/conformance/react` |
| `playwright` | `^1.49.0` | `liveframe preview capture`, the MCP server's `capture_preview` |
| `@modelcontextprotocol/server` | `^2.0.0` | `liveframe mcp` |

The backend subpaths (`/store/fs`, `/preview/worker`, the in-process package loader and the CLI) need Bun ≥ 1.4.2. The host-API-free subpaths need any ES2022 runtime. The browser subpaths (`/css`, `/react`, `/preview/react`, `/conformance/react`) need any ESM bundler. The package ships compiled ES2022 JavaScript with `.d.ts` declarations and the published JSON Schemas; [spec §13](docs/spec.md#13-tech-stack-and-packages) has the runtime matrix and package contents.

## Quickstart

A catalog, its React implementations and a validator are all a surface needs. `compileValidator` takes the validated catalog, capabilities and manifest for one widget; `createRenderer` returns the `<Surface>` that draws a tree it has validated.

```tsx
import { type Catalog, compileValidator, defineComponent, obj, str } from "@arnilo/liveframe";
import { createRenderer, implement } from "@arnilo/liveframe/react";

const text = defineComponent({
  kind: "text",
  description: "One line of text.",
  props: obj({ value: str({ maxLength: 200 }) }),
  children: "none",
  variants: ["default"],
  defaultVariant: "default",
  slots: ["root"],
  events: {},
  styleProps: [],
  a11y: { role: "paragraph" },
});

const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "The app's primitives.",
  vocabulary: {
    colourRoles: ["text.primary", "surface.base", "accent.primary"],
    surfaceRoles: ["surface.base"],
    fillableRoles: ["accent.primary"],
    typographyRoles: ["body"],
    space: ["space.1"],
    radius: ["radius.control"],
    size: ["size.glyph"],
    breakpoints: ["bp.sm"],
    tones: { default: "text.primary" },
    surfaceTypography: "body",
  },
  definitions: [text],
} as const satisfies Catalog;

const capabilities = { format: "liveframe-capabilities/1", sources: {}, actions: {} };
const manifest = {
  format: "liveframe-manifest/1",
  id: "hello",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  sources: {},
  actions: [],
};

const Text = implement(text, ({ props, slot, style }) => (
  <p className={slot("root")} style={style}>
    {props.value}
  </p>
));
const { Surface } = createRenderer({ catalog, implementations: [Text] });
const validator = compileValidator({ catalog, capabilities, manifest });
const identity = { id: "acme", version: "1.0.0" };

/** Draw a validated tree that the app's backend rendered. */
export function Hello({
  tree,
  onIntent,
}: {
  tree: unknown;
  onIntent: (intent: { type: "setState" | "action" }) => void;
}) {
  return (
    <Surface
      tree={tree}
      validator={validator}
      theme={identity}
      designSystem={identity}
      onIntent={onIntent}
      fallback={null}
    />
  );
}

export const tree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "hello",
  revision: 1,
  root: { id: "root", kind: "text", props: { value: "Hello from Liveframe" } },
};
```

Widgets are authored separately with the [SDK](docs/sdk.md), which exports `render()` and the JSX runtime and emits the tree `Hello` receives. The [preview guide](docs/preview.md) shows the backend runners that execute widget code, and the [package guide](docs/packages.md) shows how a rendered widget becomes an immutable package a host stores and places.

## What is in the package

| Import | Holds |
|---|---|
| `@arnilo/liveframe` | Definition, catalog, theme and design-system formats; the validator; the recipe resolver; `LiveframeFailure` and `LiveframeError` |
| `@arnilo/liveframe/sdk` | The JSX runtime (`/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`), intent helpers and `render()` |
| `@arnilo/liveframe/react` | The renderer: `createRenderer()`, `<Surface>` and `implement()` |
| `@arnilo/liveframe/css` | The scoped CSS projection and the class, style, scope and variable helpers; the host inserts sheets |
| `@arnilo/liveframe/pack` | Package and scenario formats, structural validators, `pack()` and `verifyPackage()` |
| `@arnilo/liveframe/store` | Record formats, the `Store` interface, `memoryStore()` and `loadPlacement()` |
| `@arnilo/liveframe/store/fs` | `fileStore(dir)`, which reads and writes the file system |
| `@arnilo/liveframe/preview` | The `Runner` interface, `inProcessRunner()` and `createPreview()` |
| `@arnilo/liveframe/preview/worker` | `workerRunner()`, which needs the `Worker` global |
| `@arnilo/liveframe/preview/react` | `<Preview>` |
| `@arnilo/liveframe/conformance` | Host-API-free catalog, design-system and store suites |
| `@arnilo/liveframe/conformance/react` | The renderer suites and `conformancePage()` |
| `@arnilo/liveframe/schemas/<format>.json` | The JSON Schema for every format |

The [spec](docs/spec.md#13-tech-stack-and-packages) defines each subpath's contract.

## Use it with a coding agent

`liveframe mcp` is an [MCP](https://modelcontextprotocol.io) server over stdio that lets a coding agent read your catalog, write a draft widget and look at its renders. It is authoring only: no tool installs, places or approves a widget, or runs an action.

1. Install the optional peers: `bun add -d @modelcontextprotocol/server`, and `bunx playwright install chromium` if the agent should capture screenshots.
2. Write a config module that default-exports an `AuthoringConfig` (your `catalog`, `capabilities`, `runner` and, for captures, a `preview(binding)` that starts your `<Preview>` page). [`examples/demo-host/mcp.config.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/examples/demo-host/mcp.config.ts) is a working one.
3. Register it with the agent. For Claude Code, put this in `.mcp.json` in your app; Claude Desktop and other clients use the same `mcpServers` shape in their own config file:

```json
{ "mcpServers": { "liveframe": { "command": "bunx", "args": ["liveframe", "mcp", "./mcp.config.ts"] } } }
```

The client starts the server itself. The [MCP guide](docs/mcp.md) covers the seven tools, captures and errors.

## Guides

- [The model](docs/model.md) — what runs where, and who owns each step
- [Formats and validation](docs/formats.md) — catalogs, themes, design systems, capabilities, manifests, trees
- [Writing widgets](docs/sdk.md) — the TSX SDK, intent helpers and `liveframe gen`
- [The renderer](docs/renderer.md) — primitives, implementations, `<Surface>` and intent handling
- [Styling](docs/styling.md) — recipes, the three sheets and scoped CSS
- [Packages, stores and runners](docs/packages.md) — `pack()`, `fileStore`, `inProcessRunner`, `workerRunner`
- [Preview and capture](docs/preview.md) — preview sessions, `<Preview>` and `liveframe preview capture`
- [Conformance](docs/conformance.md) — the test kit for an app's catalog, styling, renderer and store
- [Agent authoring over MCP](docs/mcp.md) — `liveframe mcp` and its seven tools
- [Agent walkthrough for the demo](docs/demo-agent.md) — author, capture, install and place a draft
- [Security model](docs/security.md) — what is validated where, and what is not a sandbox
- [Compatibility](docs/compatibility.md) — what a version bump may change

## Status

Pre-release (`0.1.0` is the first release). The public API, the formats and the on-disk `fileStore` layout are described by the [compatibility policy](docs/compatibility.md); the [release notes](CHANGELOG.md) list the known limitations of this release.

## Development

```bash
bun install
bun run check   # build, generated output, typecheck, lint, format, tests
```

Repository layout, roadmap and plans: [`roadmap.md`](https://github.com/ashiqrniloy/liveframe/blob/main/roadmap.md), [`plans/`](https://github.com/ashiqrniloy/liveframe/blob/main/plans/README.md). Contributing with agents: [`AGENTS.md`](https://github.com/ashiqrniloy/liveframe/blob/main/AGENTS.md). Security reports: [`SECURITY.md`](SECURITY.md).

## License

MIT — see [`LICENSE`](LICENSE).
