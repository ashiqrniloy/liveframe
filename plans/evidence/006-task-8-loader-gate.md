# Task 8 loader gate: failed on Bun 1.4.2

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
