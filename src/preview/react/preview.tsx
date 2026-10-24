import { type ComponentProps, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { Intent, Result, UiTree } from "../../index.ts";
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
  readonly result: Result<UiTree>;
  readonly intents: readonly Intent[];
  readonly renderer: ReturnType<typeof createRenderer>;
  readonly validator: ComponentProps<ReturnType<typeof createRenderer>["Surface"]>["validator"];
  readonly fallback: ReactNode;
  readonly onSelect: (cell: PreviewCell) => void;
  readonly onIntent: (intent: Intent) => void;
};
const identity = ({ id, version }: Identity) => `${id}@${version}`;
const noErrors = [] as const;

export function Preview({
  scenarios,
  widths,
  themes,
  designSystems,
  result,
  intents,
  renderer,
  validator,
  fallback,
  onSelect,
  onIntent,
}: PreviewProps) {
  const axes = { scenarios, widths, themes: themes.map(identity), designSystems: designSystems.map(identity) };
  const [cell, setCell] = useState<PreviewCell>({
    scenario: scenarios[0],
    width: widths[0],
    theme: identity(themes[0]),
    designSystem: identity(designSystems[0]),
  });
  const [received, setReceived] = useState<{
    result: Result<UiTree>;
    scenario: string | undefined;
    good: ReadonlyMap<string, UiTree>;
  }>({ result, scenario: cell.scenario, good: new Map(result.ok ? [[cell.scenario, result.value]] : []) });
  if (received.result !== result) {
    const good = new Map(received.good);
    if (result.ok) good.set(cell.scenario, result.value);
    setReceived({ result, scenario: cell.scenario, good });
  }
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const callbacks = useRef({ onSelect });
  useLayoutEffect(() => {
    callbacks.current = { onSelect };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL selection is read on mount by contract.
  useLayoutEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const first = <T extends string | number>(name: string, values: readonly T[], fallback: T): T =>
      values.find((value) => String(value) === query.get(name)) ?? fallback;
    const selected = {
      scenario: first("scenario", scenarios, scenarios[0]),
      width: first("width", widths, widths[0]),
      theme: first("theme", themes.map(identity), identity(themes[0])),
      designSystem: first("designSystem", designSystems.map(identity), identity(designSystems[0])),
    };
    setMounted(true);
    setCell(selected);
    // The initial result belongs to the URL's scenario; later scenario selections wait for a new result.
    setReceived({
      result,
      scenario: selected.scenario,
      good: new Map(result.ok ? [[selected.scenario, result.value]] : []),
    });
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(cell)) url.searchParams.set(key, String(value));
    window.history.replaceState(window.history.state, "", url);
    callbacks.current.onSelect(cell);
  }, [cell, mounted]);

  const current = received.scenario === cell.scenario ? result : undefined;
  const errors = current && !current.ok ? current.errors : noErrors;
  const tree = current?.ok ? current.value : received.good.get(cell.scenario);
  useLayoutEffect(() => {
    const element = root.current;
    if (mounted && current) element?.setAttribute("data-lf-ready", "");
    return () => element?.removeAttribute("data-lf-ready");
  });
  const { Surface } = renderer;
  return (
    <div ref={root} data-lf-preview={JSON.stringify(axes)}>
      <label>
        Scenario{" "}
        <select
          aria-label="Scenario"
          value={cell.scenario}
          onChange={(event) => {
            setReceived({ ...received, scenario: undefined });
            setCell({ ...cell, scenario: event.target.value });
          }}
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
                  <button type="button" aria-pressed={selected} onClick={() => setCell(coordinates)}>
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
