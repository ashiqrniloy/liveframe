---
date: 2026-10-23 20:16
status: approved
decision_about: "How the reference runners encode a package's data: URL and resolve its SDK imports"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Escape dots in the data: URL and resolve SDK imports from the loader

## Decision

This amends contract 3 ("Loading") of [`2026-10-22-2330-phase-2-sdk-and-package-contracts.md`](2026-10-22-2330-phase-2-sdk-and-package-contracts.md) without replacing it. The reference runners still load `code` with `import()` of a `data:` URL, but with two changes:

1. **Encoding.** The URL is `"data:text/javascript," + encodeURIComponent(code).replaceAll(".", "%2E")`.
2. **SDK resolution.** Before importing, `src/preview/load.ts` replaces the specifier in each hoisted linker header line (`import * as __lf_sdkN from "<sdk specifier>";`) with `import.meta.resolve(<sdk specifier>)`, which is resolved from the loader's own location. It does this for the three SDK specifiers (`@arnilo/liveframe/sdk`, `/sdk/jsx-runtime` and `/sdk/jsx-dev-runtime`).

The package format, the hash inputs, `pack()` and `verifyPackage()` stay as they are, and stored packages keep their bare SDK specifiers. If this amendment fails, the fallback is a factory-module package format (see Alternatives); adopting it would need its own decision log.

## Context

Plan 006 Task 8 has a pre-implementation gate, which failed on Bun 1.4.2 (`plans/evidence/006-task-8-loader-gate.md`). Both the probe `const x = { value: 3 }; export default () => x.value;` and the linked agent-home module (26,864 characters) imported with a **string** default export, not a function.

Diagnosis on 2026-10-23 with Bun 1.4.2 found two separate problems:

1. **Extension sniffing.** Bun picks a loader from the text after the last `.` in the import URL, `data:` URLs included. `encodeURIComponent` leaves `.` unescaped, so in `…x.value%3B` Bun sees a file extension it doesn't know. It falls back to the file loader, and the module's default export becomes the URL string. The evidence matches: the string returned *was* the URL.
2. **Working-directory resolution.** A bare `@arnilo/liveframe/sdk` inside a `data:` module is resolved from the process's working directory, not from the library. When the working directory was outside the repository, the import threw `Cannot find package '@arnilo/liveframe'`. Task 8 already required this check ("loader_resolves_sdk_from_other_cwd"); it was run early during the diagnosis.

## Approval

- Proposed by: agent, after reproducing and diagnosing the gate failure.
- Approved by user: Yes
- Approval evidence: in reply to "Should I write the amendment decision log and update the Task 8 gate on that basis?", the owner wrote: "Yes write the decision log. And add subtasks under task 8 to achieve the recommended way forward along with the fallback that you suggested".

## Alternatives Considered

1. **Keep the approved expression and stop** (status quo). Not selected: it does not work on the pinned runtime, and both causes are now understood.
2. **Base64 `data:` URL (`;base64,`).** It works, since base64 has no `.`, but it needs a UTF-8 → base64 step. `btoa` alone fails on non-ASCII, and the linked agent-home module contains non-ASCII text. Not selected: more code than one `replaceAll` for the same result.
3. **Append a `//.js` comment so the "extension" reads `js`.** It works, but it relies on the same undocumented sniffing it is working around. Rejected.
4. **A Bun `with { type/loader }` import attribute.** Bun-specific and untested here. Rejected because the core stays host-API-free.
5. **Leave SDK specifiers bare and require hosts to run from their project root.** Rejected: it fails for daemons and for `bun /abs/app.ts` started from `/`. It could also bind a package to a different SDK copy than the one the runner's `render()` uses.
6. **Fallback: a factory-module package format.** `code` would contain no `import` at all and default-export `(sdk) => Widget`; the loader would pass the SDK namespaces in. That removes import resolution completely. Not selected now, because it changes spec §7.3, the hash inputs, `verifyPackage`'s import rule and the `format` string (`liveframe-package/2`). It remains the planned fallback (plan 006 Task 8, subtask 8.5).
7. **`Function`/`eval`, Blob URLs, a host load hook.** Already rejected in the 2026-10-22 log and in plan 006 Task 8; nothing here changes those reasons.

## Rationale and Evidence

Probes run with Bun 1.4.2 on 2026-10-23, from the repository root unless noted:

| URL form | `typeof default` |
|---|---|
| `encodeURIComponent(code)` (approved) | `string` (the URL itself) |
| `encodeURIComponent(code).replaceAll(".", "%2E")` | `function`, returns `3` |
| `;base64,` + `btoa(code)` | `function` |
| `encodeURIComponent(code + "\n//.js")` | `function` |

- The dot-escaped linked agent-home module loads as a `function`. Importing the same URL twice returns the identical module object, so the cache keyed by URL works.
- For SDK resolution, the module was `import * as s from <spec>`, run once with the working directory at the repo root and once in a temporary directory. A bare specifier works from the root and **throws** from the temporary directory. An absolute path, a `file://` URL and `import.meta.resolve(...)` from a file inside the library each work from both.
- A `Worker` started from `/tmp` loaded a dot-escaped `data:` module whose SDK import had been rewritten with `import.meta.resolve`, and got `function`. Task 9's worker reuses `load.ts`, so it inherits both fixes.
- The 2026-10-22 spike found that "rewriting it to a `file://` URL from `import.meta.resolve` did not behave as a module import" (plan 006 Task 8, Documentation Reviewed). The probes above suggest that spike was confounded by the dot bug, since every `file://…/index.ts` contains dots. With dots escaped, the `file://` form works.
- Resolving from the loader binds the package to the **same SDK module instance** that the runner's `render()` imports. A bare specifier resolved from the working directory could pick up a different installed copy.
- Escaping `.` as `%2E` is ordinary percent-encoding, so the decoded module text is byte-identical. `encodeURIComponent` already escapes `?`, `#` and `/`.
- `import.meta` is not in the portability scan's forbidden set, and `import.meta.resolve` is standard in Bun, Node and browsers. Widget code still may not use `import.meta`; that rule (spec §10 `forbidden-import`) is unaffected.
- Upstream search: no Bun issue about `data:` URLs and extension sniffing was found ([Bun loaders docs](https://bun.com/docs/runtime/file-types.md) document extension-based loader selection for files only). Context7 is over its monthly quota, so the findings come from local runtime execution.

## References

- `plans/evidence/006-task-8-loader-gate.md`: the failed gate and its reproduction command.
- `plans/006-Phase-2-Part-B-Packages-Storage-Runners.md`, Task 8: the gate and the subtasks that carry out this decision.
- `decision-logs/2026-10-22-2330-phase-2-sdk-and-package-contracts.md`: the contract this amends (Decision item 3).
- `docs/spec.md` §7.5 (line 436): says the bare import "resolves to the host's installed SDK"; to be updated.
- `src/pack/bundle.ts:255`: the linker's hoisted `import * as __lf_sdkN from "<spec>";` header lines, which are the rewrite target.
- `src/__tests__/portability.test.ts:23-40`: the host-API scan that `load.ts` must pass, with its `import(` exception.
- [Bun file types and loaders](https://bun.com/docs/runtime/file-types.md): extension-driven loader selection.

## Consequences

- Task 8 can go ahead on the approved `data:` URL scheme. Spec §7.5 gets one sentence changed: the SDK resolves from the library's own installation, not the host's working directory.
- The loader rewrites only the linker's canonical header lines. A hand-written package that passes `verifyPackage` but imports the SDK in another form (for example `import { render } from "@arnilo/liveframe/sdk"`) keeps a bare specifier and resolves from the working directory. This limitation is documented in `load.ts` and covered by a test. Requiring the canonical header in `verifyPackage` is a possible follow-up, not part of this decision.
- A regression test pins the dot behaviour, so a Bun upgrade that changes extension sniffing shows up as a test result, not as an outage.
- Phase 6 must confirm that `import.meta.resolve("@arnilo/liveframe/sdk")` from the published `/preview` build resolves through the package's own `exports` (already listed in plan 006 Task 12).
- **Revisit**, and move to the factory-module fallback, if any of these happens: a runtime the reference runners must support ignores `%2E` or sniffs another character; `import.meta.resolve` is unavailable or gives a non-importable URL in a supported runtime or the published build; or the specifier rewrite needs more than the canonical header shape.
