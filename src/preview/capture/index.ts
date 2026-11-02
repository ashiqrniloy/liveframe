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
  /** The media coordinates this cell was captured under; present only when media was requested. */
  readonly media?: CaptureMedia;
};
/** One point on the media axes. Only the axes a call asks for appear. */
/** One point on the media axes. Only the axes a call asks for appear. */
export type CaptureMedia = {
  /** Root font-size multiplier: `2` sets `html { font-size: 200% }`. */
  readonly textScale?: number;
  readonly forcedColors?: "none" | "active";
  readonly reducedMotion?: "no-preference" | "reduce";
};
/** The media values to capture; every axis given multiplies the cells. */
export type CaptureMediaOptions = {
  readonly textScale?: readonly number[];
  readonly forcedColors?: readonly ("none" | "active")[];
  readonly reducedMotion?: readonly ("no-preference" | "reduce")[];
};
const FORCED_COLORS = ["none", "active"] as const;
const REDUCED_MOTION = ["no-preference", "reduce"] as const;
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
  /**
   * Optional: applies media before `waitReady`. A backend without it refuses a call that requests
   * media; a call without media never calls it.
   */
  emulate?(media: CaptureMedia): Promise<void>;
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
  /** Media axes to capture. Each requested value multiplies the cells; omitted axes are untouched. */
  readonly media?: CaptureMediaOptions | undefined;
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
  /** This cell's media coordinates; absent unless media was requested. */
  readonly media?: CaptureMedia;
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

type Coordinates = {
  readonly scenario: string;
  readonly width: number;
  readonly theme: string;
  readonly designSystem: string;
  readonly errors: readonly LiveframeError[];
  /** Mutable only while the capture loop attaches it; the recorded cell keeps it read-only. */
  media?: CaptureMedia;
};
/** `text2`, `forced-active`, `motion-reduce`: the media part of a cell's name and message. */
const mediaParts = (media: CaptureMedia | undefined) =>
  media === undefined
    ? []
    : [
        media.textScale === undefined ? undefined : `text${media.textScale}`,
        media.forcedColors === undefined ? undefined : `forced-${media.forcedColors}`,
        media.reducedMotion === undefined ? undefined : `motion-${media.reducedMotion}`,
      ].filter((part) => part !== undefined);
const sanitise = (cell: Coordinates) =>
  [cell.scenario, cell.width, cell.theme, cell.designSystem, ...mediaParts(cell.media)]
    .join("_")
    .replace(/[^\w.@-]/g, "-");
const label = (cell: Coordinates) =>
  `${cell.scenario} ${cell.width} ${cell.theme} ${cell.designSystem} ${mediaParts(cell.media).join(" ")}`.trimEnd();
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
function mediaList<T>(axis: string, declared: readonly T[], wanted: readonly T[] | undefined): readonly T[] {
  if (wanted === undefined) return [];
  if (!Array.isArray(wanted) || wanted.length === 0 || !wanted.every((value) => declared.includes(value)))
    throw new CaptureError(
      "unknown-name",
      `media.${axis} must be a non-empty list of ${declared.join(", ")}.`,
      `/media/${axis}`,
    );
  return wanted;
}

function scaleList(wanted: readonly number[] | undefined): readonly number[] {
  if (wanted === undefined) return [];
  if (!Array.isArray(wanted) || wanted.length === 0 || !wanted.every((scale) => isCount(scale) && scale > 0))
    throw new CaptureError(
      "unknown-name",
      "media.textScale must be a non-empty list of positive numbers.",
      "/media/textScale",
    );
  return wanted;
}

/**
 * Every media point to capture. No requested value means no media at all: no `emulate` call and no
 * `media` on any cell, so a 0.2.1 call is unchanged.
 */
function mediaCombinations(wanted: CaptureMediaOptions | undefined): readonly CaptureMedia[] {
  if (wanted === undefined) return [];
  const textScale = scaleList(wanted.textScale);
  const forcedColors = mediaList("forcedColors", FORCED_COLORS, wanted.forcedColors);
  const reducedMotion = mediaList("reducedMotion", REDUCED_MOTION, wanted.reducedMotion);
  function one<T>(values: readonly T[]): readonly (T | undefined)[] {
    return values.length ? values : [undefined];
  }
  return one(textScale).flatMap((textScale) =>
    one(forcedColors).flatMap((forcedColors) =>
      one(reducedMotion).map((reducedMotion) => mediaPoint(textScale, forcedColors, reducedMotion)),
    ),
  );
}

/** One media point holding only the axes that were asked for. */
function mediaPoint(
  textScale?: number,
  forcedColors?: "none" | "active",
  reducedMotion?: "no-preference" | "reduce",
): CaptureMedia {
  return {
    ...(textScale !== undefined && { textScale }),
    ...(forcedColors !== undefined && { forcedColors }),
    ...(reducedMotion !== undefined && { reducedMotion }),
  };
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
  cell: Coordinates,
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
  cell: Coordinates,
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

/** The declared axes, narrowed by the options; a controlled preview may only show its own scenario. */
function selectedAxes(
  declared: CaptureAxes,
  options: Pick<CaptureOptions, "scenarios" | "widths" | "themes" | "designSystems">,
) {
  const shown = declared.controlled ? declared.shown : undefined;
  if (declared.controlled && !shown) throw new CaptureError("not-found", "The controlled preview shows no scenario");
  return {
    shown,
    scenarios: shown
      ? controlledScenario(shown, options.scenarios)
      : narrow("scenario", declared.scenarios, options.scenarios),
    widths: narrow("width", declared.widths, options.widths),
    themes: narrow("theme", declared.themes, options.themes),
    designSystems: narrow("design system", declared.designSystems, options.designSystems),
  };
}

/** Refuses a media request the backend cannot honour, before any cell is captured. */
function requireEmulate<Handle>(session: CaptureSession<Handle>, media: readonly CaptureMedia[]): void {
  if (media.length === 0 || session.emulate) return;
  throw new CaptureError(
    "not-found",
    `The capture backend cannot emulate media (${[...new Set(media.flatMap(Object.keys))].join(", ")}); it needs an emulate(media) method.`,
    "/media",
  );
}

/** Every selected cell of one open session, captured at one media point. */
async function captureCells<Handle>(
  session: CaptureSession<Handle>,
  selected: readonly CaptureCell<Handle>[],
  media: CaptureMedia | undefined,
  files: Map<string, Uint8Array>,
  taken: Set<string>,
  wantLayout: boolean | undefined,
): Promise<readonly CapturedCell[]> {
  const cells: CapturedCell[] = [];
  for (const { handle, ...coordinates } of selected) {
    const cell: Coordinates = { ...coordinates };
    if (media !== undefined) cell.media = media;
    let name = sanitise(cell);
    for (let n = 2; taken.has(name); n++) name = `${sanitise(cell)}-${n}`;
    taken.add(name);
    cells.push(await captureCell(session, handle, cell, name, files, wantLayout));
  }
  return cells;
}

/** Captures an app's preview page as bytes; the caller owns persistence. */
export async function capture<Handle>(url: string, options: CaptureOptions<Handle>): Promise<CaptureResult> {
  const { backend } = options;
  let session: CaptureSession<Handle> | undefined;
  const open = async (target: string, media?: CaptureMedia) => {
    const previous = session;
    session = undefined;
    await previous?.close();
    session = await backend.open(target);
    if (media !== undefined) await session.emulate?.(media);
    await session.waitReady("[data-lf-ready]");
    return session;
  };
  try {
    const initial = await open(url);
    const declared = await initial.axes();
    if (!declared) throw new CaptureError("not-found", `${url} declares no preview axes: is it a <Preview> page?`);
    const { shown, scenarios, widths, themes, designSystems } = selectedAxes(declared, options);
    const media = mediaCombinations(options.media);
    requireEmulate(initial, media);
    const requested =
      scenarios.length * widths.length * themes.length * designSystems.length * Math.max(media.length, 1);
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
      // A controlled preview ignores the URL, so it keeps the session it already has unless media
      // must be applied before readiness.
      for (const point of media.length > 0 ? media : [undefined]) {
        const current = shown && point === undefined ? initial : await open(target.href, point);
        const selected = (await current.cells()).filter(
          (cell) =>
            cell.scenario === scenario &&
            widths.includes(cell.width) &&
            themes.includes(cell.theme) &&
            designSystems.includes(cell.designSystem),
        );
        cells.push(...(await captureCells(current, selected, point, files, taken, options.layout)));
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
