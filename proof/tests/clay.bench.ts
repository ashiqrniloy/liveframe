import { gitFixture, rackFixture } from "../host/fixtures/clay.ts";
import { render, WidgetError } from "../runtime/index.ts";
import { GitStatus } from "../widgets/clay/git-status.tsx";
import { gitOptions, initialRackState, rackOptions } from "../widgets/clay/manifest.ts";
import { RackModule } from "../widgets/clay/rack-module.tsx";

const root = gitFixture.statuses[0];
if (!root) throw new Error("Missing git fixture");
const statuses = Array.from({ length: 13 }, (_, i) => ({ ...root, workspaceRootId: `root-${i}` }));
const files = Array.from({ length: 50 }, (_, i) => ({ name: `File-${i}.tsx`, status: "M", operation: "written" }));
for (const [name, run] of [
  [
    "git status (52 label rows)",
    () => render(GitStatus, { params: {}, state: {}, data: { statuses }, context: { size: "full" } }, gitOptions),
  ],
  [
    "Rack module (50 files)",
    (i: number) =>
      render(
        RackModule,
        {
          params: {},
          state: { ...initialRackState, tab: ["files", "om", "context"][i % 3] ?? "files", draft: `Draft ${i}` },
          data: { ...rackFixture, files },
          context: { size: "full" },
        },
        rackOptions,
      ),
  ],
] as const) {
  const check = (i: number) => {
    const result = run(i);
    if (result instanceof WidgetError) throw result;
  };
  for (let i = 0; i < 200; i++) check(i);
  const start = performance.now();
  for (let i = 0; i < 1000; i++) check(i);
  const mean = (performance.now() - start) / 1000;
  console.log(`${name}: ${mean.toFixed(3)} ms mean (1000 renders, 2 ms budget)`);
  if (mean >= 2) throw new Error(`${name} exceeds 2 ms render budget`);
}
