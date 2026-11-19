// What the renderer conformance cases share across adapters: the options every suite takes and the page API the
// app-owned browser page exposes. `/conformance/react` and `/conformance/dom` differ only in how they mount.
import type { CompileValidatorOptions, DesignSystem, Intent, IntentOrigin, Json, Theme } from "../../index.ts";
import type { SurfaceEvent } from "../../surface/index.ts";

export type Styles = { theme: { id: string; version: string }; designSystem: { id: string; version: string } };

/** What every renderer suite reads: the catalog, the validator inputs, and the themes and design systems. */
export type SuiteOptions = CompileValidatorOptions & {
  themes: readonly Theme[];
  designSystems: readonly DesignSystem[];
};

/** One implementation call a page recorded: the node it drew and the props it drew with. */
export type DrawCall = {
  readonly kind: string;
  readonly domId: string;
  readonly props: Readonly<Record<string, Json>>;
};

/** What a fresh mount of one tree drew, for the structural cases. */
export type Structure = {
  /** The page's container markup, attributes sorted and style declarations written `name:value`. */
  readonly html: string;
  readonly calls: readonly DrawCall[];
  readonly events: readonly SurfaceEvent[];
};

/** The API a conformance page puts on `window.liveframeConformance`; the suites drive it through Playwright. */
export type ConformancePageApi = {
  mount(input: unknown, styles: Styles, mode?: "fallback" | "keep-last"): void;
  switch(styles: Styles): void;
  intents(): Intent[];
  emissions(): { intent: Intent; origin: IntentOrigin }[];
  /** What the surface reported to `onEvent`, such as `focus-missed`. */
  events(): SurfaceEvent[];
  /** How many times an implementation drew since the page loaded. */
  renders(): number;
  /** React only: hydrates server markup and reports recoverable errors and whether the server nodes were kept. */
  hydrate?(markup: string, input: unknown, styles: Styles): Promise<{ errors: string[]; retained: boolean }>;
  /** DOM only: the fallback's markup as the page serializes it, or canonical as `structure` writes it. */
  fallbackMarkup?(canonical?: boolean): string;
  /** DOM only: mounts `input` afresh and reports what it drew. */
  structure?(input: unknown, styles: Styles): Structure;
  /** DOM only: the markup a wholly invalid arrival of `tree` must draw under `styles`. */
  fallbackSurface?(tree: unknown, styles: Styles): string;
};

declare global {
  interface Window {
    liveframeConformance: ConformancePageApi;
  }
}
