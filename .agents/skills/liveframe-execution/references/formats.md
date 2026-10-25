# Formats and the validator

## Target

Spec §4 (concepts), §5 (definitions), §9 (UI tree), §10 (validation). Roadmap Phase 1.

- **Definition:** `kind`, `props` (closed JSON Schema), `children` (`none` | `any` | allowed kinds with counts), `events` (each carrying one intent), `variants`, `slots`, `styleProps`, `a11y`. Data only.
- **Catalog:** a versioned set of definitions with a `catalogId` (`acme.ui@1`). Primitives only.
- **UI tree:** `format: "liveframe/1"`, `catalogId`, `surfaceId`, `revision`, and `root: UiNode`. Each node has `id` (key path), `kind`, `variant?`, `props`, `style?`, `events?` and `children?`. A whole tree goes out per render.
- **Intent:** `{type:"setState", key, value?}` or `{type:"action", name, args}`.
- **Validator:** every check in spec §10. Defaults: 5,000 nodes, depth 64, 1 MiB, all configurable. Errors are typed, with a path, so an agent can act on them.

Rules:
- JSON Schema and TS types change together, with a test that keeps them in step.
- Every rejection the spec names has a failing-case test.
- Validation is fail-closed: an unknown field, kind, variant, event, key or style prop is an error, never ignored.

## Today

The root export (`src/index.ts`) provides the schema builders and readonly `Infer<>`, `checkValue`, `isLanguageSchema`, `LiveframeError`/`Result`, all install-format types and validators, `defineComponent`, `classifyCatalogChange`, `resolveRecipes`, the tree/intent types, and `compileValidator`. Implementations live in `src/schema.ts`, `src/formats/`, `src/resolve.ts` and `src/validate/`; `docs/formats.md` documents their contracts, including the worked Validation guide.

`compileValidator({ catalog, capabilities, manifest })` install-validates its inputs and throws a `LiveframeFailure` carrying the bounded `errors` on failure (same for `resolveRecipes` and `styleDeclarations`; `/react`'s `RendererError` extends it). On success it returns `{ checkNode, validateTree }` and nothing else — `render()` reads the build facts through a module-private `WeakMap` in `src/validate/compile.ts` (`buildFacts`), never a public field. The root exports `CompileValidatorOptions`, `CompiledValidator`, `ValidateTreeOptions`, `LiveframeFailure` and `LiveframeError`; the old `NodeCheck`/`NodeCheckSink` aliases are gone (spell the signature as `Parameters<CompiledValidator["checkNode"]>`). `checkNode(node, pointer, sink)` checks a node for builders; whole-tree relationships and budgets require `validateTree(tree, options?)`, returning `Result<UiTree>`. Compile when the installed documents change; validate each render before backend transport and on arrival. Defaults: 5,000 nodes, depth 64 (root level 1), 1 MiB UTF-8 JSON bytes, 20 errors plus a truncation marker when that bound is reached. Successful validation preserves the original, unfrozen tree. The host still re-checks completed action args and authorises on dispatch.

A widget manifest's `params`, `state` and `context` may not contain `pattern`: those schemas are matched against values the app does not author, on the host and in the browser (spec §5). `validateManifest`/`validateManifestShape` reject the keyword at its pointer before matching anything, and `manifest.json` omits it; catalog and capability schemas keep it. `proof/widgets/*/manifest.ts` declares its state schemas without patterns, and the exported fixtures follow.

`schemas/` publishes seven JSON Schema 2020-12 documents through `@arnilo/liveframe/schemas/*`. Vocabulary and definitions are embedded in the catalog schema. Published schemas check structure; cross-document relationships require the install validators. `ui-tree.json` is catalog-independent: tree membership, intent compatibility and render limits require `compileValidator`, implementing spec §10.

`src/__tests__/` covers the formats, schema drift, Ajv agreement, install budgets and browser bundling/host-API portability. Proof-derived JSON fixtures live in `src/__tests__/fixtures/proof/`; regenerate them with `timeout 60s bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof`. The exporter checks recipe equivalence without introducing a `src/` import of proof code.
