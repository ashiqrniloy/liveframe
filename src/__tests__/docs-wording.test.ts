import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import manifest from "../../package.json" with { type: "json" };
import { packageDirs, readManifest } from "../../scripts/release/packages.ts";

const root = new URL("../../", import.meta.url);

function plannedExports(markdown: string, exported: Set<string>): string[] {
  return markdown
    .split(/(?<=[.!?])\s+|\n\s*\n/)
    .filter(
      (sentence) =>
        /\bplanned\b/i.test(sentence) &&
        [...sentence.matchAll(/[A-Za-z_$][\w$]*/g)].some(([name]) => exported.has(name)),
    );
}

test("wording_check_matches_export_names_in_the_same_sentence", () => {
  const exported = new Set(["implement", "Preview"]);
  expect(plannedExports("The planned `implement(definition, Component)` binds it.", exported)).toHaveLength(1);
  expect(plannedExports("`Preview` remains planned.", exported)).toHaveLength(1);
  expect(plannedExports("`implement()` ships. More features are planned.", exported)).toEqual([]);
  expect(plannedExports("A planned implementation guide.", exported)).toEqual([]);
});

test("shipped_docs_never_call_exports_planned", async () => {
  const exported = new Set<string>();
  for (const entry of Object.values(manifest.exports)) {
    if (typeof entry === "string") continue; // JSON Schema assets have no module exports.
    const module = await import(new URL(entry["liveframe:source"], root).href);
    for (const name of Object.keys(module)) exported.add(name);
  }
  expect(exported.has("implement")).toBe(true);

  // The normative spec also describes future work; the guides describe shipped APIs.
  const files = [
    "README.md",
    ...(await readdir(new URL("docs/", root)))
      .filter((name) => name.endsWith(".md") && name !== "spec.md")
      .map((name) => `docs/${name}`),
  ];
  const stale: string[] = [];
  for (const file of files) {
    const markdown = await Bun.file(new URL(file, root)).text();
    for (const sentence of plannedExports(markdown, exported)) stale.push(`${file}: ${sentence.trim()}`);
  }
  expect(stale).toEqual([]);
});

test("no_doc_cites_the_unreleased_0_3_1", async () => {
  const files = ["README.md", "SECURITY.md", "CHANGELOG.md"];
  for await (const file of new Bun.Glob("docs/**/*.md").scan(root.pathname)) files.push(file);
  for (const dir of await packageDirs()) {
    if (dir !== ".") files.push(`${dir}/README.md`);
  }

  const stale: string[] = [];
  for (const file of files) {
    const markdown = await Bun.file(new URL(file, root)).text();
    for (const paragraph of markdown.split(/\n\s*\n/)) {
      if (file === "docs/compatibility.md" && paragraph.startsWith("**The 0.3.x promise.**")) continue;
      if (/\b(?:from|in)\s+`?v?0\.3\.1\b/i.test(paragraph)) stale.push(`${file}: ${paragraph}`);
    }
  }
  expect(stale).toEqual([]);
});

test("security_policy_and_release_checklist_name_every_package", async () => {
  const security = await Bun.file(new URL("SECURITY.md", root)).text();
  const compatibility = await Bun.file(new URL("docs/compatibility.md", root)).text();
  const release = compatibility.split("\n## Release process\n")[1]?.split("\n## ")[0] ?? "";
  for (const dir of await packageDirs()) {
    const { name } = await readManifest(dir);
    expect(security).toContain(`\`${name}\``);
    expect(release).toContain(`\`${name}\``);
  }
});
