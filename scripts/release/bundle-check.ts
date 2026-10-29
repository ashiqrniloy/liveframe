import { parse } from "acorn";

type Node = { type: string; value?: unknown; [key: string]: unknown };

/**
 * Throws unless a runner kit bundle is a single self-contained ES module: no import
 * declarations or re-exports from elsewhere, no dynamic `import()`, no `import.meta`,
 * and no `node:` or `bun:` specifier anywhere in its strings.
 */
export function assertSelfContained(code: string): void {
  const problems = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!value || typeof value !== "object" || !("type" in value)) return;
    const node = value as Node;
    if (node.type === "ImportDeclaration") problems.add("an import declaration");
    else if (node.type === "ImportExpression") problems.add("a dynamic import()");
    else if (node.type === "MetaProperty" && (node.meta as Node).name === "import") problems.add("import.meta");
    else if ((node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && node.source)
      problems.add("a re-export from another module");
    else if (node.type === "Literal" && typeof node.value === "string" && /^(?:node|bun):/.test(node.value))
      problems.add(`the specifier ${JSON.stringify(node.value)}`);
    for (const child of Object.values(node)) visit(child);
  };
  visit(parse(code, { ecmaVersion: "latest", sourceType: "module" }));
  if (problems.size > 0) throw new Error(`The runner kit bundle is not self-contained: ${[...problems].join(", ")}`);
}
