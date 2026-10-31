import type { LiveframeError } from "../../index.ts";
export { playwrightBackend } from "./playwright.ts";
export type CaptureAxes = {
  readonly scenarios: readonly string[];
  readonly widths: readonly number[];
  readonly themes: readonly string[];
  readonly designSystems: readonly string[];
  readonly urlKey?: string;
  readonly controlled?: boolean;
  readonly shown?: string;
};
export type CaptureCell<Handle = unknown> = {
  readonly handle: Handle;
  readonly scenario: string;
  readonly width: number;
  readonly theme: string;
  readonly designSystem: string;
  readonly errors: readonly LiveframeError[];
};
/** One cell's geometry in integer CSS pixels, relative to the cell. Numbers and node ids only. */
export type CellLayout = {
  readonly width: number;
  readonly height: number;
  readonly overflowX: boolean;
  /** Ids of the nodes whose box crosses the cell's right edge, in DOM order. */
  readonly overflowing: readonly string[];
  readonly nodes: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
};
export interface CaptureSession<Handle = unknown> {
  waitReady(selector: string): Promise<void>;
  axes(): Promise<CaptureAxes | null>;
  cells(): Promise<readonly CaptureCell<Handle>[]>;
  screenshot(cell: Handle): Promise<Uint8Array>;
  ariaSnapshot(cell: Handle): Promise<string | null>;
  /** Optional: a backend without it gives `layout: null` for every cell. */
  layout?(cell: Handle): Promise<CellLayout | null>;
  close(): Promise<void>;
}
export interface CaptureBackend<Handle = unknown> {
  open(url: string): Promise<CaptureSession<Handle>>;
  close?(): Promise<void>;
}
export type CaptureOptions<Handle = unknown> = {
  readonly backend: CaptureBackend<Handle>;
  readonly scenarios?: readonly string[] | undefined;
  readonly widths?: readonly number[] | undefined;
  readonly themes?: readonly string[] | undefined;
  readonly designSystems?: readonly string[] | undefined;
  /** Refuses a call that would capture more cells than this, before any cell is captured. */
  readonly maxCells?: number | undefined;
  /** Also writes each cell's geometry as `<cell>.layout.json`. Default false. */
  readonly layout?: boolean | undefined;
};
export type CapturedCell = {
  readonly scenario: string;
  readonly width: number;
  readonly theme: string;
  readonly designSystem: string;
  readonly png: string;
  readonly snapshot: string | null;
  readonly errors: readonly LiveframeError[];
  /** The layout file, or null when the backend cannot measure; absent unless requested. */
  readonly layout?: string | null;
};
export type CaptureIndex = { readonly url: string; readonly cells: readonly CapturedCell[] };
export type CaptureResult = { readonly index: CaptureIndex; readonly files: Map<string, Uint8Array> };
/** The capture failure kinds a caller can map to a `LiveframeError` without reading the message. */
export type CaptureErrorKind = "unknown-name" | "not-found" | "limit-exceeded";

export class CaptureError extends Error {
  override name = "CaptureError";
  constructor(
    readonly kind: CaptureErrorKind,
    message: string,
    /** The argument at fault, when the failure names one. */
    readonly pointer = "",
  ) {
    super(message);
  }
}

/** A serialized layout record larger than this is refused rather than truncated. */
const MAX_LAYOUT_BYTES = 262144;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const hasOnly = (value: object, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
/** A backend's layout must be exactly the documented numbers and ids; nothing else reaches an agent. */
function isLayout(value: unknown): value is CellLayout {
  const layout = value as CellLayout | null;
  return (
    typeof layout === "object" &&
    layout !== null &&
    hasOnly(layout, ["width", "height", "overflowX", "overflowing", "nodes"]) &&
    isCount(layout.width) &&
    isCount(layout.height) &&
    typeof layout.overflowX === "boolean" &&
    Array.isArray(layout.overflowing) &&
    layout.overflowing.every((id) => typeof id === "string") &&
    Array.isArray(layout.nodes) &&
    layout.nodes.every(
      (node) =>
        typeof node === "object" &&
        node !== null &&
        hasOnly(node, ["id", "x", "y", "width", "height"]) &&
        typeof node.id === "string" &&
        [node.x, node.y, node.width, node.height].every(isCount),
    )
  );
}

const sanitise = (cell: Omit<CapturedCell, "png" | "snapshot" | "errors" | "layout">) =>
  [cell.scenario, cell.width, cell.theme, cell.designSystem].join("_").replace(/[^\w.@-]/g, "-");
const label = (cell: Pick<CapturedCell, "scenario" | "width" | "theme" | "designSystem">) =>
  `${cell.scenario} ${cell.width} ${cell.theme} ${cell.designSystem}`;
function narrow<T>(axis: string, declared: readonly T[], wanted: readonly T[] | undefined): readonly T[] {
  if (!wanted) return declared;
  const missing = wanted.filter((value) => !declared.includes(value));
  if (missing.length)
    throw new CaptureError(
      "unknown-name",
      `The page declares no ${axis} ${missing.join(", ")}; it declares ${declared.join(", ")}.`,
    );
  return wanted;
}
/** A controlled preview ignores the URL, so only the scenario it shows can be captured. */
function controlledScenario(shown: string, wanted: readonly string[] | undefined): readonly [string] {
  const other = wanted?.filter((value) => value !== shown) ?? [];
  if (other.length)
    throw new CaptureError(
      "not-found",
      `This <Preview> is controlled and shows ${shown}; the URL cannot select ${other.join(", ")}.`,
    );
  return [shown];
}

/** Captures one cell's files into `files` and returns its index record. */
async function captureCell<Handle>(
  session: CaptureSession<Handle>,
  handle: Handle,
  cell: Omit<CaptureCell, "handle">,
  name: string,
  files: Map<string, Uint8Array>,
  wantLayout: boolean | undefined,
): Promise<CapturedCell> {
  const encoder = new TextEncoder();
  files.set(`${name}.png`, await session.screenshot(handle));
  const snapshot = await session.ariaSnapshot(handle);
  if (snapshot !== null) files.set(`${name}.aria.yml`, encoder.encode(`${snapshot}\n`));
  const layout = wantLayout ? await measureLayout(session, handle, cell, encoder) : undefined;
  if (layout) files.set(`${name}.layout.json`, layout);
  return {
    ...cell,
    png: `${name}.png`,
    snapshot: snapshot === null ? null : `${name}.aria.yml`,
    ...(wantLayout && { layout: layout ? `${name}.layout.json` : null }),
  };
}

/** One cell's serialized layout, or undefined when the backend cannot measure. */
async function measureLayout<Handle>(
  session: CaptureSession<Handle>,
  handle: Handle,
  cell: Pick<CapturedCell, "scenario" | "width" | "theme" | "designSystem">,
  encoder: TextEncoder,
): Promise<Uint8Array | undefined> {
  const layout = (await session.layout?.(handle)) ?? null;
  if (layout === null) return undefined;
  if (!isLayout(layout)) throw new Error(`The backend's layout for ${label(cell)} is not a CellLayout.`);
  const bytes = encoder.encode(`${JSON.stringify(layout)}\n`);
  if (bytes.length > MAX_LAYOUT_BYTES)
    throw new CaptureError(
      "limit-exceeded",
      `The layout for ${label(cell)} is ${bytes.length} bytes; at most ${MAX_LAYOUT_BYTES}. Narrow the scenario: nodes are never truncated.`,
      "/layout",
    );
  return bytes;
}

/** Captures an app's preview page as bytes; the caller owns persistence. */
export async function capture<Handle>(url: string, options: CaptureOptions<Handle>): Promise<CaptureResult> {
  const { backend } = options;
  let session: CaptureSession<Handle> | undefined;
  const open = async (target: string) => {
    const previous = session;
    session = undefined;
    await previous?.close();
    session = await backend.open(target);
    await session.waitReady("[data-lf-ready]");
    return session;
  };
  try {
    const initial = await open(url);
    const declared = await initial.axes();
    if (!declared) throw new CaptureError("not-found", `${url} declares no preview axes: is it a <Preview> page?`);
    const shown = declared.controlled ? declared.shown : undefined;
    if (declared.controlled && !shown) throw new CaptureError("not-found", "The controlled preview shows no scenario");
    const scenarios = shown
      ? controlledScenario(shown, options.scenarios)
      : narrow("scenario", declared.scenarios, options.scenarios);
    const widths = narrow("width", declared.widths, options.widths);
    const themes = narrow("theme", declared.themes, options.themes);
    const designSystems = narrow("design system", declared.designSystems, options.designSystems);
    const requested = scenarios.length * widths.length * themes.length * designSystems.length;
    if (options.maxCells !== undefined && requested > options.maxCells)
      throw new CaptureError(
        "limit-exceeded",
        `Requested ${requested} cells; at most ${options.maxCells} per call. Narrow with scenarios (${declared.scenarios.join(", ")}), widths (${declared.widths.join(", ")}), themes (${declared.themes.join(", ")}) or designSystems (${declared.designSystems.join(", ")}) — leave an argument out to keep every declared value.`,
      );
    const files = new Map<string, Uint8Array>();
    const cells: CapturedCell[] = [];
    const taken = new Set<string>();
    const encoder = new TextEncoder();
    for (const scenario of scenarios) {
      const target = new URL(url);
      target.searchParams.set(declared.urlKey ? `${declared.urlKey}.scenario` : "scenario", scenario);
      const current = shown ? initial : await open(target.href);
      const selected = (await current.cells()).filter(
        (cell) =>
          cell.scenario === scenario &&
          widths.includes(cell.width) &&
          themes.includes(cell.theme) &&
          designSystems.includes(cell.designSystem),
      );
      for (const { handle, ...coordinates } of selected) {
        let name = sanitise(coordinates);
        for (let n = 2; taken.has(name); n++) name = `${sanitise(coordinates)}-${n}`;
        taken.add(name);
        cells.push(await captureCell(current, handle, coordinates, name, files, options.layout));
      }
    }
    const index = { url, cells };
    files.set("index.json", encoder.encode(`${JSON.stringify(index, null, 2)}\n`));
    return { index, files };
  } finally {
    try {
      await session?.close();
    } finally {
      await backend.close?.();
    }
  }
}
