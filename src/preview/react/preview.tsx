import { type ComponentProps, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { Intent, IntentOrigin, Result, UiTree } from "../../index.ts";
import type { createRenderer } from "../../react/index.ts";

type Identity = { readonly id: string; readonly version: string };
export type PreviewCell = {
  readonly scenario: string;
  readonly width: number;
  readonly theme: string;
  readonly designSystem: string;
};
export type PreviewProps = {
  readonly scenarios: readonly [string, ...string[]];
  readonly widths: readonly [number, ...number[]];
  readonly themes: readonly [Identity, ...Identity[]];
  readonly designSystems: readonly [Identity, ...Identity[]];
  /** The scenario `result` was rendered for. It is the only label the component trusts. */
  readonly resultScenario: string;
  readonly result: Result<UiTree>;
  /** Supplying it makes the preview controlled: it never reads or writes `location`. */
  readonly selection?: PreviewCell;
  /** Prefix for the uncontrolled URL keys, so two previews on one page stay apart. */
  readonly urlKey?: string;
  readonly intents: readonly Intent[];
  readonly renderer: ReturnType<typeof createRenderer>;
  readonly validator: ComponentProps<ReturnType<typeof createRenderer>["Surface"]>["validator"];
  readonly fallback: ReactNode;
  readonly onSelect: (cell: PreviewCell) => void;
  readonly onIntent: (intent: Intent, origin: IntentOrigin) => void;
};
const identity = ({ id, version }: Identity) => `${id}@${version}`;
const noErrors = [] as const;
/** The axis entry equal to `found`, else the first entry, as an absent URL value does. */
const match = <T extends string | number>(values: readonly [T, ...T[]], found: string | null): T =>
  values.find((value) => String(value) === found) ?? values[0];
const urlName = (urlKey: string | undefined, name: keyof PreviewCell) => (urlKey ? `${urlKey}.${name}` : name);

export function Preview({
  scenarios,
  widths,
  themes,
  designSystems,
  resultScenario,
  result,
  selection,
  urlKey,
  intents,
  renderer,
  validator,
  fallback,
  onSelect,
  onIntent,
}: PreviewProps) {
  const themes$ = themes.map(identity) as [string, ...string[]];
  const designSystems$ = designSystems.map(identity) as [string, ...string[]];
  const axes = { scenarios, widths, themes: themes$, designSystems: designSystems$ };
  const [chosen, setChosen] = useState<PreviewCell>({
    scenario: scenarios[0],
    width: widths[0],
    theme: identity(themes[0]),
    designSystem: identity(designSystems[0]),
  });
  const cell = selection
    ? {
        scenario: match(scenarios, selection.scenario),
        width: match(widths, String(selection.width)),
        theme: match(themes$, selection.theme),
        designSystem: match(designSystems$, selection.designSystem),
      }
    : chosen;
  const [received, setReceived] = useState<{ result: Result<UiTree>; good: ReadonlyMap<string, UiTree> }>({
    result,
    good: new Map(result.ok ? [[resultScenario, result.value]] : []),
  });
  if (received.result !== result) {
    const good = new Map(received.good);
    if (result.ok) good.set(resultScenario, result.value);
    setReceived({ result, good });
  }
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const callbacks = useRef({ onSelect });
  useLayoutEffect(() => {
    callbacks.current = { onSelect };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL selection is read on mount by contract.
  useLayoutEffect(() => {
    setMounted(true);
    if (selection) return;
    const query = new URLSearchParams(window.location.search);
    setChosen({
      scenario: match(scenarios, query.get(urlName(urlKey, "scenario"))),
      width: match(widths, query.get(urlName(urlKey, "width"))),
      theme: match(themes$, query.get(urlName(urlKey, "theme"))),
      designSystem: match(designSystems$, query.get(urlName(urlKey, "designSystem"))),
    });
  }, []);

  useLayoutEffect(() => {
    if (selection || !mounted) return;
    const url = new URL(window.location.href);
    for (const name of ["scenario", "width", "theme", "designSystem"] as const)
      url.searchParams.set(urlName(urlKey, name), String(chosen[name]));
    window.history.replaceState(window.history.state, "", url);
    callbacks.current.onSelect(chosen);
  }, [chosen, mounted, urlKey, selection]);

  const select = (next: PreviewCell) => {
    if (selection) callbacks.current.onSelect(next);
    else setChosen(next);
  };
  const current = resultScenario === cell.scenario ? result : undefined;
  const errors = current && !current.ok ? current.errors : noErrors;
  const tree = current?.ok ? current.value : received.good.get(cell.scenario);
  useLayoutEffect(() => {
    const element = root.current;
    if (mounted && current) element?.setAttribute("data-lf-ready", "");
    return () => element?.removeAttribute("data-lf-ready");
  });
  const { Surface } = renderer;
  return (
    <div
      ref={root}
      data-lf-preview={JSON.stringify(selection ? { ...axes, controlled: true } : urlKey ? { ...axes, urlKey } : axes)}
    >
      <label>
        Scenario{" "}
        <select
          aria-label="Scenario"
          value={cell.scenario}
          onChange={(event) => select({ ...cell, scenario: event.target.value })}
        >
          {scenarios.map((scenario) => (
            <option key={scenario}>{scenario}</option>
          ))}
        </select>
      </label>
      <div style={{ display: "grid", gap: 16, justifyItems: "start" }}>
        {widths.flatMap((width) =>
          themes.flatMap((theme) =>
            designSystems.map((designSystem) => {
              const coordinates = {
                scenario: cell.scenario,
                width,
                theme: identity(theme),
                designSystem: identity(designSystem),
              };
              const selected = Object.entries(coordinates).every(
                ([key, value]) => cell[key as keyof PreviewCell] === value,
              );
              return (
                <section
                  key={JSON.stringify(coordinates)}
                  data-lf-cell={JSON.stringify(coordinates)}
                  data-lf-selected={selected}
                  data-lf-errors={JSON.stringify(errors)}
                  style={{ width, outline: selected ? "2px solid" : undefined, outlineOffset: 2 }}
                >
                  <button type="button" aria-pressed={selected} onClick={() => select(coordinates)}>
                    {width}px · {coordinates.theme} · {coordinates.designSystem}
                  </button>
                  {current && !current.ok && tree && <p>last good render</p>}
                  <div style={{ opacity: current && !current.ok && tree ? 0.5 : undefined }}>
                    {tree ? (
                      <Surface
                        key={cell.scenario}
                        tree={tree}
                        validator={validator}
                        theme={theme}
                        designSystem={designSystem}
                        fallback={fallback}
                        onIntent={onIntent}
                        diagnostics={errors}
                      />
                    ) : (
                      fallback
                    )}
                  </div>
                  <ul aria-label="Render errors">
                    {errors.map((error, i) => (
                      <li key={String(i)}>
                        {error.nodeId && `${error.nodeId}: `}
                        {error.pointer}: {error.message}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }),
          ),
        )}
      </div>
      <ol aria-label="Intent log">
        {intents.map((intent, i) => (
          <li key={String(i)}>
            <pre>{JSON.stringify(intent)}</pre>
          </li>
        ))}
      </ol>
    </div>
  );
}
