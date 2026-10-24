# Liveframe

`@arnilo/liveframe` — runtime-composable UI.

An app ships a small set of trusted **primitive components** and a **design system**. People and AI agents write **TSX widgets** against those primitives, and the widgets change the app's UI at runtime, with no deployment. Widget code runs on the app's backend; the browser only draws a validated tree with the app's own components, so everything looks native and nothing untrusted runs in the page.

Status: pre-release. The root package provides formats, install validators, a compiled tree validator and recipe resolution. The SDK provides TSX authoring, intent helpers, validated rendering and typed component generation. Packages, reference stores, backend runners and the scoped CSS projection are also available. See the [styling guide](docs/styling.md), [package guide](docs/packages.md), [format and validation guide](docs/formats.md), [SDK guide](docs/sdk.md), [preview guide](docs/preview.md), [agent guide](docs/mcp.md) and [`roadmap.md`](roadmap.md) for execution state.

- Design: [`docs/spec.md`](docs/spec.md)
- How a surface gets from code to the browser, and who owns each step: [`docs/model.md`](docs/model.md)
- Roadmap and execution state: [`roadmap.md`](roadmap.md)
- Plans: [`plans/`](plans/README.md)
- Decisions: [`decision-logs/`](decision-logs/)
- Contributing with agents: [`AGENTS.md`](AGENTS.md)

## Development

```bash
bun install
bun run check   # typecheck, lint, format check, tests
```
