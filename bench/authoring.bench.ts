import { strict as assert } from "node:assert";
import { drafts, packageOptions } from "../src/__tests__/fixtures/widgets/drafts.ts";
import { createAuthoring } from "../src/authoring/index.ts";
import { inProcessRunner } from "../src/preview/in-process.ts";
import { budget, metric } from "./metrics.ts";

const draft = drafts[0]!;
const mib = 1024 * 1024;
const input = { ...draft, files: { [draft.entry]: " ".repeat(9 * mib) } };
const authoring = createAuthoring({ ...packageOptions, runner: inProcessRunner() });
try {
  const growth: number[] = [];
  for (let i = 0; i < 9; i++) {
    const before = process.memoryUsage.rss();
    const result = await authoring.packDraft(input);
    growth.push(Math.max(0, process.memoryUsage.rss() - before));
    assert(!result.ok && result.errors[0]?.kind === "limit-exceeded" && result.errors[0].pointer === "/files");
  }
  const rss = growth.sort((a, b) => a - b)[4]!;
  metric("authoring.refuse9MiB.rssGrowthBytes", rss);
  console.log(`Authoring: refused a 9 MiB inline draft, ${rss} bytes median RSS growth`);
  budget(rss < mib, `Inline draft refusal grew RSS by ${rss} bytes, over the 1 MiB budget`);
} finally {
  await authoring.close();
}
