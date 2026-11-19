/**
 * The switching sequence of spec §6.4, shared by `/react` and `/dom`. Transitions are suppressed on the wrapper and
 * the portal container while the caller applies the new scope attributes; the next frame resolves the new styles
 * while they are still suppressed, even before the first paint, and releases them.
 */

const SWITCHING = "data-lf-switching";

/**
 * Marks the scopes as switching, then releases them next frame. The caller applies the new scope attributes right
 * after this returns. The returned function ends the sequence at once; call it before starting another.
 */
export function beginSwitch(scopes: readonly (Element | null)[]): () => void {
  const elements = scopes.filter((element): element is Element => element !== null);
  for (const element of elements) element.setAttribute(SWITCHING, "");
  const view = elements[0]?.ownerDocument.defaultView;
  const clear = () => {
    for (const element of elements) element.removeAttribute(SWITCHING);
  };
  let frame: number | undefined;
  const release = () => {
    frame = undefined;
    for (const element of elements) void (element as HTMLElement).offsetWidth;
    clear();
  };
  if (view) frame = view.requestAnimationFrame(release);
  else release();
  return () => {
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
    frame = undefined;
    clear();
  };
}
