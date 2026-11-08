/** The limits one render runs under inside the sandbox. */
export type Limits = {
  readonly memoryBytes: number;
  readonly stackBytes: number;
  /** The soft deadline: QuickJS's interrupt handler stops the render this long after it starts. */
  readonly timeoutMs: number;
};

/** What the host asks the child to render. `libraries` maps `liveframe:lib/<id>@<version>` to linked code. */
export type RenderRequest = {
  readonly type: "render";
  readonly id: number;
  readonly code: string;
  readonly libraries: Readonly<Record<string, string>>;
  readonly request: string;
  readonly limits: Limits;
  /** Set when the runtime is kept between renders (`reuse: "package"`): the package hash. */
  readonly key?: string;
};

export type ChildMessage =
  | { readonly type: "ready" }
  | { readonly type: "result"; readonly id: number; readonly json: string }
  | { readonly type: "result"; readonly id: number; readonly error: string };

export type Reason = "timeout" | "memory" | "stack";

/**
 * Which limit a QuickJS message names. The engine reports a stopped render as an ordinary message
 * (spike finding F7), so the host classifies by text: a widget that throws the same words only
 * changes the kind of its own failure.
 */
export function limitOf(message: string): Reason | undefined {
  if (/\binterrupted\b/i.test(message)) return "timeout";
  if (/stack overflow|maximum call stack/i.test(message)) return "stack";
  if (/out of memory|string too long|too large|invalid array length/i.test(message)) return "memory";
  return undefined;
}
