import type { LiveframeError, Result } from "../errors.ts";

/** The three specifiers `pack()` leaves bare in a package's code. */
export const sdkSpecifiers = [
  "@arnilo/liveframe/sdk",
  "@arnilo/liveframe/sdk/jsx-runtime",
  "@arnilo/liveframe/sdk/jsx-dev-runtime",
] as const;
export type SdkSpecifier = (typeof sdkSpecifiers)[number];

const headerStart = "import * as __lf_sdk";
const headerLine = /^import \* as __lf_sdk(\d+) from "([^"\n]*)";$/;

function invalid(message: string, expected?: string): Result<never> {
  const error: LiveframeError = { kind: "invalid-document", pointer: "/code", message };
  return { ok: false, errors: [expected === undefined ? error : { ...error, expected }] };
}

/**
 * Rewrites the linker header `pack()` emits: leading lines of exactly
 * `import * as __lf_sdk<N> from "<sdk specifier>";`, numbered from 0 in order, one per
 * specifier. `resolve` returns what the sandbox imports instead. Everything after the
 * header is returned byte for byte, so SDK-looking text in widget code is never touched
 * and code with no header is accepted unchanged. A header line that is not canonical
 * is an error rather than a guess.
 */
export function linkPackage(code: string, resolve: (specifier: SdkSpecifier) => string): Result<string> {
  const seen = new Set<string>();
  let linked = "";
  let at = 0;
  while (code.startsWith(headerStart, at)) {
    const end = code.indexOf("\n", at);
    const line = code.slice(at, end === -1 ? code.length : end);
    const match = headerLine.exec(line);
    const specifier = match?.[2] as SdkSpecifier | undefined;
    if (!match || !specifier || !sdkSpecifiers.includes(specifier))
      return invalid(
        `Malformed SDK header line ${seen.size}`,
        `import * as __lf_sdk${seen.size} from "<sdk specifier>";`,
      );
    if (Number(match[1]) !== seen.size || String(seen.size) !== match[1])
      return invalid(`SDK header line ${seen.size} must bind __lf_sdk${seen.size}`);
    if (seen.has(specifier)) return invalid(`SDK header imports ${specifier} twice`);
    seen.add(specifier);
    linked += `import * as __lf_sdk${match[1]} from ${JSON.stringify(resolve(specifier))};`;
    if (end === -1) return { ok: true, value: linked };
    linked += "\n";
    at = end + 1;
  }
  return { ok: true, value: linked + code.slice(at) };
}
