# Task 8 loader gate

## Original gate: failed on Bun 1.4.2

Reproduced on 2026-10-23 before implementing the runner. Both required probes
return a string default export instead of a function through the approved
percent-encoded `data:` loader. This confirms Task 4's finding and invalidates
the simple-module spike supporting plan 005 Task 1 and
`decision-logs/2026-10-22-2330-phase-2-sdk-and-package-contracts.md` for this loader.

Run from the repository root:

```bash
timeout 20s bun run - <<'BUN'
import { bundle } from './src/pack/bundle.ts';
console.log('Bun', Bun.version);
const simple = 'const x = { value: 3 }; export default () => x.value;';
const paths = ['ui.gen.ts', ...['queue', 'task-card', 'decision-card', 'alert-card', 'facts', 'queue-row'].map(name => `agent-home/${name}.tsx`)];
const files = Object.fromEntries(await Promise.all(paths.map(async path => [path, await Bun.file(`src/__tests__/fixtures/widgets/${path}`).text()])));
files['agent-home/queue.tsx'] += '\nexport default AgentHomeQueue;';
const linked = bundle({ files, entry: 'agent-home/queue.tsx' });
if (!linked.ok) throw new Error(JSON.stringify(linked.errors));
for (const [name, code] of [['property-access', simple], ['linked-agent-home', linked.value]]) {
  const module = await import('data:text/javascript,' + encodeURIComponent(code));
  console.log(JSON.stringify({ name, codeLength: code.length, defaultType: typeof module.default }));
}
BUN
```

Observed output:

```text
Bun 1.4.2
{"name":"property-access","codeLength":53,"defaultType":"string"}
{"name":"linked-agent-home","codeLength":26864,"defaultType":"string"}
```

Expected `defaultType` is `function` for both modules; the simple function should
return `3`. The linked source is the actual seven-file agent-home fixture used
by the bundle tests, with its entry's default export appended.

Per Task 8's explicit stop condition, no production loader, substitute loading
scheme or runner was implemented. The outside-working-directory check and runner
tests remain pending. The loader decision must be revisited before Tasks 8–10
can complete; this finding does not select a replacement or amend the spec.

Context7's Bun documentation lookup failed with `Monthly quota exceeded`.
The evidence above comes from the local Bun runtime, not inferred documentation.

## Amended gate: passed on Bun 1.4.2

Re-run on 2026-10-23 for subtask 8.1, following the approved amendment in
`decision-logs/2026-10-23-2016-data-url-loader-encoding-and-sdk-resolution.md`.

Two causes explain the original failure: Bun sniffs a loader from the text after
the last `.` in the URL, and `encodeURIComponent` leaves dots unescaped. An
unrecognised extension selects the file loader, whose default export is the URL
string. Separately, bare SDK specifiers in a `data:` module resolve from the
process's working directory, which can be outside the library's installation.

The amended probe is `plans/evidence/006-task-8-loader-gate.ts`. It bundles the
same seven-file agent-home fixture, loads both modules with
`encodeURIComponent(code).replaceAll(".", "%2E")`, and asserts that both default
exports are functions. It also asserts that the `x.value` function returns `3`.

For the outside-repository checks, the script rewrites only canonical linker
SDK header specifiers using `import.meta.resolve` from its own location inside
the package. It asserts that at least one header was rewritten, then passes the
same rewritten agent-home source to a subprocess whose working directory is a
new system temporary directory. That subprocess imports it on the main thread
and in a worker started from that temporary directory. Both paths construct the
dot-escaped URL and assert a function default export. The subprocess has a
15-second timeout, and temporary files are removed in `finally`.

Run from the repository root:

```bash
timeout 30s bun plans/evidence/006-task-8-loader-gate.ts
```

Observed output (exit code 0):

```text
Bun 1.4.2
{"name":"property-access","defaultType":"function"}
{"name":"linked-agent-home","defaultType":"function"}
{"name":"outside-main-agent-home","defaultType":"function"}
{"name":"outside-worker-agent-home","defaultType":"function"}
```

All four probes passed without an outside-repository import error. Subtask 8.1
is complete; its fallback condition was not triggered. The production loader,
its regression tests, spec amendment and runner remain in subtasks 8.2–8.4.
