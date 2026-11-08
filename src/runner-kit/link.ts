import type { LiveframeError, Result } from "../errors.ts";

/** The three specifiers `pack()` leaves bare in a package's code. */
export const sdkSpecifiers = [
  "@arnilo/liveframe/sdk",
  "@arnilo/liveframe/sdk/jsx-runtime",
  "@arnilo/liveframe/sdk/jsx-dev-runtime",
] as const;
export type SdkSpecifier = (typeof sdkSpecifiers)[number];

const libraryPattern = /^liveframe:lib\/([a-z][a-zA-Z0-9.-]*)@([A-Za-z0-9._+-]+)$/;

/** `liveframe:lib/<id>@<version>`: how a package names a library it imports (plan 030 Task 9). */
export function librarySpecifier(id: string, version: string): string {
  return `liveframe:lib/${id}@${version}`;
}

/** The `(id, version)` of a library specifier, or undefined when the text is not one. */
export function parseLibrarySpecifier(
  specifier: string,
): { readonly id: string; readonly version: string } | undefined {
  const match = libraryPattern.exec(specifier);
  return match ? { id: match[1] as string, version: match[2] as string } : undefined;
}

const sdkStart = "import * as __lf_sdk";
const sdkLine = /^import \* as __lf_sdk(\d+) from "([^"\n]*)";$/;
const libStart = "import * as __lf_lib";
const libLine = /^import \* as __lf_lib(\d+) from "([^"\n]*)";$/;

/** A library import's specifier, `liveframe:lib/<id>@<version>`. */
export type LibrarySpecifier = `liveframe:lib/${string}@${string}`;

function invalid(message: string, expected?: string): Result<never> {
  const error: LiveframeError = { kind: "invalid-document", pointer: "/code", message };
  return { ok: false, errors: [expected === undefined ? error : { ...error, expected }] };
}

/**
 * Rewrites the linker header `pack()` emits: leading lines of exactly
 * `import * as __lf_sdk<N> from "<sdk specifier>";`, then lines of exactly
 * `import * as __lf_lib<N> from "liveframe:lib/<id>@<version>";`, each kind numbered from 0 in
 * order, one per specifier. `resolve` returns what the sandbox imports instead: for a library it
 * receives the library specifier, and the sandbox decides what module that names. Everything after
 * the header is returned byte for byte, so SDK-looking text in widget code is never touched and
 * code with no header is accepted unchanged. A header line that is not canonical is an error
 * rather than a guess.
 */
export function linkPackage(
  code: string,
  resolve: (specifier: SdkSpecifier | LibrarySpecifier) => string,
): Result<string> {
  let linked = "";
  let at = 0;
  for (const kind of [
    {
      start: sdkStart,
      line: sdkLine,
      name: "SDK",
      local: "__lf_sdk",
      allowed: (s: string) => sdkSpecifiers.includes(s as SdkSpecifier),
      shape: "<sdk specifier>",
    },
    {
      start: libStart,
      line: libLine,
      name: "library",
      local: "__lf_lib",
      allowed: (s: string) => parseLibrarySpecifier(s) !== undefined,
      shape: "liveframe:lib/<id>@<version>",
    },
  ]) {
    const seen = new Set<string>();
    while (code.startsWith(kind.start, at)) {
      const end = code.indexOf("\n", at);
      const line = code.slice(at, end === -1 ? code.length : end);
      const match = kind.line.exec(line);
      const specifier = match?.[2];
      if (!match || !specifier || !kind.allowed(specifier))
        return invalid(
          `Malformed ${kind.name} header line ${seen.size}`,
          `import * as ${kind.local}${seen.size} from "${kind.shape}";`,
        );
      if (Number(match[1]) !== seen.size || String(seen.size) !== match[1])
        return invalid(`${kind.name} header line ${seen.size} must bind ${kind.local}${seen.size}`);
      if (seen.has(specifier)) return invalid(`${kind.name} header imports ${specifier} twice`);
      seen.add(specifier);
      linked += `import * as ${kind.local}${match[1]} from ${JSON.stringify(resolve(specifier as SdkSpecifier | LibrarySpecifier))};`;
      if (end === -1) return { ok: true, value: linked };
      linked += "\n";
      at = end + 1;
    }
  }
  return { ok: true, value: linked + code.slice(at) };
}
