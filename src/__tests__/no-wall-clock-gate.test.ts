import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as acorn from "acorn";

const ROOT = resolve(import.meta.dir, "../..");

const ALLOWLIST = new Set(["src/__tests__/compiled-schema.test.ts", "src/__tests__/sdk-stream.test.ts"]);

const COMPARISON_MATCHERS = new Set([
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
]);

type Node = acorn.AnyNode;

function isClockCall(node: Node | null | undefined): boolean {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return false;
  return (callee.object.name === "performance" || callee.object.name === "Date") && callee.property.name === "now";
}

function collectPatternNames(pattern: Node | null | undefined, out: string[]): void {
  if (!pattern) return;
  switch (pattern.type) {
    case "Identifier":
      out.push(pattern.name);
      break;
    case "ArrayPattern":
      for (const el of pattern.elements) collectPatternNames(el, out);
      break;
    case "ObjectPattern":
      for (const prop of pattern.properties) {
        collectPatternNames(prop.type === "Property" ? prop.value : prop.argument, out);
      }
      break;
    case "RestElement":
      collectPatternNames(pattern.argument, out);
      break;
    case "AssignmentPattern":
      collectPatternNames(pattern.left, out);
      break;
  }
}

function visitChildren(node: Node, fn: (child: Node) => void): void {
  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "type" in item) fn(item as Node);
      }
    } else if ("type" in value) {
      fn(value as Node);
    }
  }
}

/** Extracts direct property taint when an initializer/return is an ObjectExpression (e.g. `{ cold, elements }`). */
function returnedObjectClockProps(expr: Node, tainted: Set<string>): Set<string> | null {
  const returns: acorn.ObjectExpression[] = [];
  const walk = (n: Node) => {
    if (n.type === "ObjectExpression") {
      returns.push(n);
      return;
    }
    if (n.type === "ReturnStatement" && n.argument?.type === "ObjectExpression") {
      returns.push(n.argument);
      return;
    }
    if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") {
      if (n.body.type === "ObjectExpression") returns.push(n.body);
      else visitChildren(n.body, walk);
      return;
    }
    visitChildren(n, walk);
  };
  walk(expr);
  if (returns.length === 0) return null;
  const props = new Set<string>();
  for (const obj of returns) {
    for (const p of obj.properties) {
      if (p.type !== "Property" || p.computed) continue;
      const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : null;
      if (key && usesClock(p.value, tainted, new Map())) props.add(key);
    }
  }
  return props;
}

function usesClock(
  node: Node | null | undefined,
  tainted: Set<string>,
  objectProps: Map<string, Set<string>>,
): boolean {
  if (!node) return false;
  if (isClockCall(node)) return true;
  if (node.type === "Identifier") return tainted.has(node.name);
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.property.type === "Identifier"
  ) {
    const props = objectProps.get(node.object.name);
    if (props) return props.has(node.property.name);
    if (node.property.name === "length") return false;
  }
  let found = false;
  visitChildren(node, (child) => {
    if (usesClock(child, tainted, objectProps)) found = true;
  });
  return found;
}

function collectViolations(ast: acorn.Program, relPath: string): string[] {
  const tainted = new Set<string>();
  const objectProps = new Map<string, Set<string>>();
  const violations: string[] = [];

  const recordInit = (name: string, init: Node) => {
    const props = returnedObjectClockProps(init, tainted);
    if (props) {
      objectProps.set(name, props);
      if (props.size > 0) tainted.add(name);
    } else if (usesClock(init, tainted, objectProps)) {
      tainted.add(name);
    }
  };

  // Two passes catch clock bindings declared before helper calls in the same file.
  const collectTainted = (node: Node) => {
    if (node.type === "VariableDeclarator" && node.init) {
      if (node.id.type === "Identifier") {
        recordInit(node.id.name, node.init);
      } else if (usesClock(node.init, tainted, objectProps)) {
        const names: string[] = [];
        collectPatternNames(node.id, names);
        for (const name of names) tainted.add(name);
      }
    } else if (node.type === "AssignmentExpression" && node.left.type === "Identifier") {
      recordInit(node.left.name, node.right);
    } else if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "push" &&
      node.callee.object.type === "Identifier" &&
      node.arguments.some((arg) => usesClock(arg, tainted, objectProps))
    ) {
      tainted.add(node.callee.object.name);
    }
    visitChildren(node, collectTainted);
  };

  collectTainted(ast);
  collectTainted(ast);

  const checkExpects = (node: Node) => {
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      COMPARISON_MATCHERS.has(node.callee.property.name)
    ) {
      const expectCall = node.callee.object;
      if (
        expectCall.type === "CallExpression" &&
        expectCall.callee.type === "Identifier" &&
        expectCall.callee.name === "expect" &&
        expectCall.arguments.some((arg) => usesClock(arg, tainted, objectProps))
      ) {
        const line = node.loc?.start.line ?? 0;
        violations.push(`${relPath}:${line} (${node.callee.property.name})`);
      }
    }
    visitChildren(node, checkExpects);
  };

  checkExpects(ast);
  return violations;
}

test("no_wall_clock_assertions_in_the_gate", () => {
  const globs = [
    "src/__tests__/**/*.test.{ts,tsx}",
    "proof/tests/**/*.test.{ts,tsx}",
    "packages/*/src/__tests__/**/*.test.{ts,tsx}",
  ];
  const transpilerTs = new Bun.Transpiler({ loader: "ts" });
  const transpilerTsx = new Bun.Transpiler({ loader: "tsx" });
  const violations: string[] = [];

  for (const pattern of globs) {
    const glob = new Bun.Glob(pattern);
    for (const relPath of glob.scanSync({ cwd: ROOT })) {
      if (relPath === "src/__tests__/no-wall-clock-gate.test.ts") continue;
      if (ALLOWLIST.has(relPath)) continue;
      const source = readFileSync(resolve(ROOT, relPath), "utf8");
      const js = relPath.endsWith(".tsx") ? transpilerTsx.transformSync(source) : transpilerTs.transformSync(source);
      const ast = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module", locations: true });
      violations.push(...collectViolations(ast, relPath));
    }
  }

  expect(violations).toEqual([]);
});
