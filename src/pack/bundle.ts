import { type AnyNode, type Identifier, type Literal, type Node, type Pattern, parse } from "acorn";
import { transform } from "sucrase";
import type { LiveframeError, Result } from "../errors.ts";
import { documentChecks } from "../formats/capabilities.ts";

const sdkSpecifiers = new Set([
  "@arnilo/liveframe/sdk",
  "@arnilo/liveframe/sdk/jsx-runtime",
  "@arnilo/liveframe/sdk/jsx-dev-runtime",
]);

class BundleFailure extends Error {
  constructor(readonly errors: readonly LiveframeError[]) {
    super(errors[0]?.message);
  }
}

function fail(kind: LiveframeError["kind"], pointer: string, message: string): never {
  throw new BundleFailure([{ kind, pointer, message }]);
}

function pointer(file: string, line?: number): string {
  return `/files/${file.replace(/~/g, "~0").replace(/\//g, "~1")}${line === undefined ? "" : `/${line}`}`;
}

function isNode(value: unknown): value is AnyNode {
  return value !== null && typeof value === "object" && "type" in value && typeof value.type === "string";
}

function walk(node: AnyNode, visit: (node: AnyNode, insideFunction: boolean) => void, insideFunction = false): void {
  visit(node, insideFunction);
  const nested =
    insideFunction || ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) walk(child, visit, nested);
    } else if (isNode(value)) walk(value, visit, nested);
  }
}

/** One import rule for source modules and untrusted, already-linked packages. */
export function checkModule(source: string, at: string, allowRelative = false): Result<ReturnType<typeof parse>> {
  const c = documentChecks();
  try {
    const ast = parse(source, { ecmaVersion: "latest", sourceType: "module", locations: true });
    walk(ast, (node) => {
      if (c.errors.length >= 20) return;
      const location = `${at}/${node.loc?.start.line ?? 1}`;
      if (
        node.type === "ImportExpression" ||
        (node.type === "MetaProperty" && node.meta.name === "import") ||
        (node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "require")
      )
        c.reject(location, "Dynamic imports, import.meta and require are forbidden", "forbidden-import");
      if (
        (node.type === "ImportDeclaration" ||
          node.type === "ExportNamedDeclaration" ||
          node.type === "ExportAllDeclaration") &&
        node.source
      ) {
        const specifier = String(node.source.value);
        if (!sdkSpecifiers.has(specifier) && !(allowRelative && /^\.\.?\//.test(specifier)))
          c.reject(location, `Import ${specifier} is not allowed`, "forbidden-import");
      }
    });
    return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: ast };
  } catch (error) {
    const syntax = error as { loc?: { line?: number }; message?: string };
    c.reject(`${at}/${syntax.loc?.line ?? 1}`, syntax.message ?? "Invalid widget syntax", "transpile-failed");
    return { ok: false, errors: c.errors };
  }
}

function name(node: Identifier | Literal): string {
  return node.type === "Identifier" ? node.name : String(node.value);
}

function bindings(pattern: Pattern): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "RestElement":
      return bindings(pattern.argument);
    case "AssignmentPattern":
      return bindings(pattern.left);
    case "ArrayPattern":
      return pattern.elements.flatMap((item) => (item ? bindings(item) : []));
    case "ObjectPattern":
      return pattern.properties.flatMap((item) => bindings(item.type === "RestElement" ? item.argument : item.value));
    default:
      return [];
  }
}

function resolve(files: Readonly<Record<string, string>>, from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (!parts.length) fail("invalid-document", pointer(from), `Import ${specifier} escapes the widget's files`);
      parts.pop();
    } else parts.push(part);
  }
  const base = parts.join("/");
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (Object.hasOwn(files, base + suffix)) return base + suffix;
  }
  return fail("invalid-document", pointer(from), `Cannot resolve ${specifier} from ${from}`);
}

/** Transpile and link without evaluating code. Imports and exports are snapshots, not live bindings. */
export function bundle({
  files,
  entry,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly entry: string;
}): Result<string> {
  const modules = new Map<string, { id: string; exports: Set<string> }>();
  const active: string[] = [];
  const output: string[] = [];
  const sdk = new Map<string, string>();

  function visit(file: string): { id: string; exports: Set<string> } {
    if (active.includes(file))
      fail(
        "invalid-document",
        pointer(file),
        `Import cycle: ${[...active.slice(active.indexOf(file)), file].join(" → ")}`,
      );
    const cached = modules.get(file);
    if (cached) return cached;
    const input = files[file];
    if (!Object.hasOwn(files, file) || input === undefined)
      fail("invalid-document", pointer(file), `Missing file ${file}`);
    const module = { id: `__lf_m${modules.size}`, exports: new Set<string>() };
    modules.set(file, module);
    active.push(file);

    let source: string;
    let ast: ReturnType<typeof parse>;
    try {
      source = transform(input, {
        transforms: ["typescript", "jsx"],
        jsxRuntime: "automatic",
        jsxImportSource: "@arnilo/liveframe/sdk",
        production: true,
        filePath: file,
        // Preserve runtime imports for the allowlist, even when no binding is used.
        keepUnusedImports: true,
        disableESTransforms: true,
      }).code;
      // A hashbang is legal only at the start of the final module, not inside a wrapper.
      if (source.startsWith("#!")) source = `//${source.slice(2)}`;
    } catch (error) {
      const syntax = error as { loc?: { line?: number }; message?: string };
      fail("transpile-failed", pointer(file, syntax.loc?.line ?? 1), syntax.message ?? "Invalid widget syntax");
    }
    const checked = checkModule(source, pointer(file), true);
    if (!checked.ok) throw new BundleFailure(checked.errors);
    ast = checked.value;

    let asynchronous = false;
    walk(ast, (node, insideFunction) => {
      if (!insideFunction && (node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await)))
        asynchronous = true;
      const location = pointer(file, node.loc?.start.line ?? 1);
      if (node.type === "Identifier" && node.name.startsWith("__lf_")) {
        fail("invalid-document", location, "Identifiers starting with __lf_ are reserved for the linker");
      }
    });

    const edits: { start: number; end: number; text: string }[] = [];
    const imports: string[] = [];
    const exports = new Map<string, string>();
    const stars: string[] = [];
    const edit = (node: Node, text: string) => edits.push({ start: node.start, end: node.end, text });
    const dependency = (specifier: string): string => {
      if (!sdkSpecifiers.has(specifier)) return visit(resolve(files, file, specifier)).id;
      let id = sdk.get(specifier);
      if (!id) {
        id = `__lf_sdk${sdk.size}`;
        sdk.set(specifier, id);
      }
      return id;
    };

    for (const node of ast.body) {
      if (node.type === "ImportDeclaration") {
        const id = dependency(String(node.source.value));
        for (const item of node.specifiers) {
          const value =
            item.type === "ImportNamespaceSpecifier"
              ? id
              : `${id}[${JSON.stringify(item.type === "ImportDefaultSpecifier" ? "default" : name(item.imported))}]`;
          imports.push(`const ${item.local.name} = ${value};`);
        }
        edit(node, "");
      } else if (node.type === "ExportDefaultDeclaration") {
        const declaration = node.declaration;
        if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id) {
          edits.push({ start: node.start, end: declaration.start, text: "" });
          exports.set("default", declaration.id.name);
        } else {
          edit(node, `const __lf_default = ${source.slice(declaration.start, declaration.end)};`);
          exports.set("default", "__lf_default");
        }
      } else if (node.type === "ExportNamedDeclaration") {
        if (node.declaration) {
          const declaration = node.declaration;
          const names =
            declaration.type === "VariableDeclaration"
              ? declaration.declarations.flatMap((item) => bindings(item.id))
              : declaration.id
                ? [declaration.id.name]
                : [];
          for (const local of names) exports.set(local, local);
          edits.push({ start: node.start, end: declaration.start, text: "" });
        } else {
          const id = node.source ? dependency(String(node.source.value)) : undefined;
          for (const item of node.specifiers)
            exports.set(name(item.exported), id ? `${id}[${JSON.stringify(name(item.local))}]` : name(item.local));
          edit(node, "");
        }
      } else if (node.type === "ExportAllDeclaration") {
        const id = dependency(String(node.source.value));
        if (node.exported) exports.set(name(node.exported), id);
        else stars.push(id);
        edit(node, "");
      }
    }

    for (const change of edits.sort((a, b) => b.start - a.start)) {
      source = source.slice(0, change.start) + change.text + source.slice(change.end);
    }
    for (const key of exports.keys()) module.exports.add(key);
    // Export-star excludes default; explicit exports override star exports.
    const starExports = stars.map(
      (id) => `for (const __lf_key in ${id}) if (__lf_key !== "default") __lf_exports[__lf_key] = ${id}[__lf_key];`,
    );
    const assignments = [...exports].map(([key, value]) => `__lf_exports[${JSON.stringify(key)}] = ${value};`);
    output.push(
      `const ${module.id} = ${asynchronous ? "await (async" : "("}() => {\n${imports.join("\n")}\n${source}\nconst __lf_exports = { __proto__: null };\n${[...starExports, ...assignments].join("\n")}\nreturn __lf_exports;\n})();`,
    );
    active.pop();
    return module;
  }

  try {
    const main = visit(entry);
    if (!main.exports.has("default")) fail("invalid-document", pointer(entry), "The entry must have a default export");
    return {
      ok: true,
      value: [
        ...[...sdk].map(([specifier, id]) => `import * as ${id} from ${JSON.stringify(specifier)};`),
        ...output,
        `export default ${main.id}["default"];`,
      ].join("\n"),
    };
  } catch (error) {
    if (error instanceof BundleFailure) return { ok: false, errors: error.errors };
    throw error;
  }
}
