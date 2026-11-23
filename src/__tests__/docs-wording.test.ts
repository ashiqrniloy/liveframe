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

test("changelog_0_4_1_has_a_line_for_every_register_entry", async () => {
  const changelog = await Bun.file(new URL("CHANGELOG.md", root)).text();
  const section = changelog.split("\n## 0.4.1 ")[1]?.split("\n## ")[0] ?? "";
  expect(section).not.toBe("");
  const missing: string[] = [];
  for (const file of ["register-0.4.1.json", "register-0.4.1-starter.json"]) {
    const entries: { name: string }[] = await Bun.file(new URL(`scripts/release/api/${file}`, root)).json();
    // A member reference such as `HostWiring.runOptions` names its declaration too.
    for (const { name } of entries)
      if (![`\`${name}\``, `\`${name}.`].some((form) => section.includes(form))) missing.push(`${file}: ${name}`);
  }
  expect(missing).toEqual([]);
});

/** Drops the text where a later release may be named: the adopter notes' "Not delivered" table and the checklist's request column. */
function shippedText(file: string, markdown: string): string {
  if (file === "docs/adopters-0.4.md") return markdown.replace(/\n## Not delivered\n[\s\S]*?(?=\n## |$)/, "\n");
  if (file === "docs/security-checklist.md") return markdown.replace(/^(\|.*\|)[^|\n]*\|[ \t]*$/gm, "$1");
  return markdown;
}

test("no_doc_presents_a_later_release_item_as_shipped", async () => {
  const files = ["README.md", "SECURITY.md", "CHANGELOG.md"];
  for await (const file of new Bun.Glob("docs/**/*.md").scan(root.pathname)) files.push(file);
  for (const dir of await packageDirs()) {
    if (dir !== ".") files.push(`${dir}/README.md`);
  }

  const stale: string[] = [];
  for (const file of files) {
    const markdown = shippedText(file, await Bun.file(new URL(file, root)).text());
    for (const paragraph of markdown.split(/\n\s*\n/)) {
      if (/\b(?:from|in)\s+`?v?0\.(?:5|6)\.0\b/i.test(paragraph)) stale.push(`${file}: ${paragraph}`);
    }
  }
  expect(stale).toEqual([]);
});

test("later_release_check_ignores_only_the_not_delivered_table_and_request_column", () => {
  const notes = "## A\n\nShips in 0.5.0.\n\n## Not delivered\n\n| x | in 0.5.0 |\n";
  expect(shippedText("docs/adopters-0.4.md", notes)).toContain("Ships in 0.5.0.");
  expect(shippedText("docs/adopters-0.4.md", notes)).not.toContain("| x | in 0.5.0 |");
  const checklist = "| a | in 0.5.0 | c | [LF-1](x) in 0.5.0 |\n";
  expect(shippedText("docs/security-checklist.md", checklist)).toBe("| a | in 0.5.0 | c |\n");
});
