import type { AnyNode } from "acorn";
import { parseLibrarySpecifier } from "../runner-kit/link.ts";

const libraryBinding = /^__lf_lib\d+$/;

/** What a linked package's code says about the libraries it imports and the names it exports. */
export type Links = {
  /** Library imports in source order: `import * as <local> from "<specifier>"`. */
  readonly imports: readonly { readonly specifier: string; readonly local: string }[];
  /** The names read from each library binding: `__lf_lib0["Card"]`. */
  readonly used: ReadonlyMap<string, ReadonlySet<string>>;
  /** Names exported with `export { x as Name }`, the form `pack()` emits for a library. */
  readonly exports: ReadonlySet<string>;
  /** The line of the first library reference that is not the canonical import or a string-keyed read. */
  readonly stray: number | undefined;
};

function exportedName(node: { type: string; name?: string; value?: unknown }): string {
  return node.type === "Identifier" ? String(node.name) : String(node.value);
}

/**
 * Collects a package's library links during `checkModule`'s single walk. `pack()` emits each library
 * as one namespace import, `import * as __lf_lib0 from "liveframe:lib/…"`, and reads it only as
 * `__lf_lib0["Name"]`; any other mention of a `__lf_lib*` binding is `stray`, so the names a package
 * uses are exactly the names this scan reports.
 */
export function linkScan() {
  const imports: { specifier: string; local: string }[] = [];
  const used = new Map<string, Set<string>>();
  const exported = new Set<string>();
  const allowed = new Set<AnyNode>();
  let stray: number | undefined;
  const flag = (node: AnyNode): void => {
    stray ??= node.loc?.start.line ?? 1;
  };
  return {
    visit(node: AnyNode): void {
      if (node.type === "ImportDeclaration" && parseLibrarySpecifier(String(node.source.value))) {
        const [only] = node.specifiers;
        if (node.specifiers.length === 1 && only?.type === "ImportNamespaceSpecifier") {
          allowed.add(only.local);
          imports.push({ specifier: String(node.source.value), local: only.local.name });
        } else flag(node);
      } else if (node.type === "ExportNamedDeclaration" && !node.source) {
        for (const item of node.specifiers) exported.add(exportedName(item.exported));
      } else if (
        node.type === "MemberExpression" &&
        node.computed &&
        node.object.type === "Identifier" &&
        libraryBinding.test(node.object.name) &&
        node.property.type === "Literal" &&
        typeof node.property.value === "string"
      ) {
        allowed.add(node.object);
        const names = used.get(node.object.name) ?? new Set<string>();
        names.add(node.property.value);
        used.set(node.object.name, names);
      } else if (node.type === "Identifier" && libraryBinding.test(node.name) && !allowed.has(node)) flag(node);
    },
    result(): Links {
      return { imports, used, exports: exported, stray };
    },
  };
}
