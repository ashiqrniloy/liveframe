import type { UiTree } from "@arnilo/liveframe";
import {
  type Capabilities,
  type Catalog,
  type CompiledValidator,
  compileValidator,
  type LiveframeError,
  type Manifest,
  type Result,
} from "@arnilo/liveframe";
import { type EngineFailure, limitOf } from "./protocol.ts";

const KINDS = new Set<LiveframeError["kind"]>([
  "invalid-document",
  "insufficient-contrast",
  "unknown-name",
  "incomplete-design-system",
  "colour-outside-theme",
  "catalog-mismatch",
  "cyclic-extends",
  "forbidden-import",
  "transpile-failed",
  "hash-mismatch",
  "version-conflict",
  "stale-patch",
  "not-found",
  "host-element",
  "unknown-component",
  "invalid-prop",
  "invalid-children",
  "missing-key",
  "duplicate-key",
  "undeclared-event",
  "undeclared-action",
  "function-prop",
  "async-render",
  "render-failed",
  "limit-exceeded",
]);
/** One more than the validator's own bound: it appends a marker after the 20th error. */
const MAX_ERRORS = 21;
const MAX_TEXT = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const failed = (kind: LiveframeError["kind"], message: string, pointer = ""): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer, message }],
});

/** The limit a stopped render hit, as the `limit-exceeded` it is reported as. */
function limitFailure(message: string): Result<never> | undefined {
  const reason = limitOf(message);
  return reason === undefined ? undefined : failed("limit-exceeded", `Render stopped: ${reason}`);
}

const engineErrorNames = new Set([
  "AggregateError",
  "EvalError",
  "InternalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "a non-Error value",
]);

export function engineFailure(answer: EngineFailure, debug: boolean): Result<never> {
  const { error, thrownName } = answer;
  if (thrownName === undefined) return limitFailure(error) ?? failed("render-failed", error.slice(0, MAX_TEXT));
  if (thrownName === "InternalError") {
    const limit = limitFailure(error);
    if (limit) return limit;
  }
  const name = engineErrorNames.has(thrownName) ? thrownName : "Error";
  return {
    ok: false,
    errors: [
      {
        kind: "render-failed",
        pointer: "",
        message: `Widget threw ${name}`,
        ...(debug ? { debug: error.slice(0, MAX_TEXT) } : {}),
      },
    ],
  };
}

/** Failure messages from the sandbox are untrusted text. Bound them before returning them. */
function sanitized(errors: unknown, debug: boolean): Result<never> | undefined {
  if (!Array.isArray(errors) || errors.length === 0 || errors.length > MAX_ERRORS) return undefined;
  const clean: LiveframeError[] = [];
  for (const error of errors) {
    if (
      !isRecord(error) ||
      typeof error.kind !== "string" ||
      !KINDS.has(error.kind as LiveframeError["kind"]) ||
      typeof error.pointer !== "string" ||
      typeof error.message !== "string"
    )
      return undefined;
    if (
      error.kind === "render-failed" &&
      error.message === "Widget threw InternalError" &&
      typeof error.debug === "string"
    ) {
      const limit = limitFailure(error.debug);
      if (limit) return limit;
    }
    clean.push({
      kind: error.kind as LiveframeError["kind"],
      pointer: error.pointer.slice(0, MAX_TEXT),
      message: error.message.slice(0, MAX_TEXT),
      ...(typeof error.expected === "string" ? { expected: error.expected.slice(0, MAX_TEXT) } : {}),
      ...(typeof error.nodeId === "string" ? { nodeId: error.nodeId.slice(0, MAX_TEXT) } : {}),
      ...(debug && typeof error.debug === "string" ? { debug: error.debug.slice(0, MAX_TEXT) } : {}),
    });
  }
  return { ok: false, errors: clean };
}

type Install = { readonly catalog: Catalog; readonly capabilities: Capabilities; readonly manifest: Manifest };

/** Compiled validators per `(catalog, capabilities)` and verified package hash; the 64 most recent are kept. */
const validators = new WeakMap<Catalog, WeakMap<Capabilities, Map<string, CompiledValidator>>>();
const MAX_VALIDATORS = 64;

export function validatorFor(install: Install, hash: string): CompiledValidator {
  let byCapabilities = validators.get(install.catalog);
  if (!byCapabilities) {
    byCapabilities = new WeakMap();
    validators.set(install.catalog, byCapabilities);
  }
  let byHash = byCapabilities.get(install.capabilities);
  if (!byHash) {
    byHash = new Map();
    byCapabilities.set(install.capabilities, byHash);
  }
  const known = byHash.get(hash);
  if (known) {
    byHash.delete(hash);
    byHash.set(hash, known);
    return known;
  }
  const validator = compileValidator(install);
  byHash.set(hash, validator);
  const oldest = byHash.keys().next();
  if (byHash.size > MAX_VALIDATORS && !oldest.done) byHash.delete(oldest.value);
  return validator;
}

/**
 * The host's answer to the sandbox's one JSON string (law 2): the text is parsed here, a failure list is
 * shape-checked and bounded, and a tree is validated by the host's own compiled validator before anyone
 * sees it. Anything else is `render-failed`.
 */
export function accept(
  json: string,
  install: Install,
  hash: string,
  limits: Parameters<CompiledValidator["validateTree"]>[1],
  debug: boolean,
): Result<UiTree> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return failed("render-failed", "The sandbox returned a malformed result");
  }
  if (!isRecord(parsed)) return failed("render-failed", "The sandbox returned a malformed result");
  if (parsed.ok === false)
    return sanitized(parsed.errors, debug) ?? failed("render-failed", "The sandbox returned a malformed result");
  if (parsed.ok !== true || !("value" in parsed))
    return failed("render-failed", "The sandbox returned a malformed result");
  try {
    return validatorFor(install, hash).validateTree(parsed.value, limits);
  } catch (error) {
    return failed("render-failed", error instanceof Error ? error.message.slice(0, MAX_TEXT) : "Validation failed");
  }
}
