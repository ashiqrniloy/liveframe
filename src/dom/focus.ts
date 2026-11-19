/**
 * Focus rules shared by `/react` and `/dom` (spec §11): focus continuity when an update removes the focused element,
 * and the tree's focus mark. Framework-free: each adapter calls these around its own commit.
 */
import type { UiTree } from "../index.ts";
import { isThenable } from "../internal.ts";
import type { SurfaceEvent } from "../surface/index.ts";

/** The surface's wrapper first, then its portal container. */
export type FocusScope = readonly (Element | null)[];

/**
 * Sequential focus navigation order (HTML, "tabindex processing"): the elements a Tab key may reach.
 * The snapshot only collects what matches inside the surface; whether a candidate is reachable
 * (not disabled, inert, hidden or unrendered) is checked after the update, on the rare path where
 * focus was lost, and only on the candidates tried. `tabIndex` already reads -1 for a div or an
 * anchor without `href`.
 */
const tabbableSelector =
  "a[href], area[href], button, input, select, textarea, iframe, object, embed, summary, [tabindex]";
// `Node.compareDocumentPosition` bitmasks.
const FOLLOWING = 4;
const PRECEDING = 2;

function tabbableNow(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.hasAttribute("disabled")) return false;
  if (element.getAttribute("type") === "hidden" || element.closest("[inert]")) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return (
    style !== undefined &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    element.getClientRects().length > 0
  );
}

const isHTMLElement = (element: Element | null | undefined): element is HTMLElement =>
  !!element && "focus" in element && "tabIndex" in element;

export type FocusSnapshot = {
  readonly focused: HTMLElement;
  /** The focused text control's selection, put back when a move blurred it. */
  readonly selection: readonly [number, number] | undefined;
  readonly after: readonly HTMLElement[];
  readonly before: readonly HTMLElement[];
};

/**
 * Before an update: the focused element, when it is inside the surface, and the tabbable elements on either side.
 * One query over the wrapper and the portal container, with no style or layout read, so its cost does not depend
 * on the host page.
 */
export function focusSnapshot(scope: FocusScope): FocusSnapshot | null {
  const focused = scope.find(Boolean)?.ownerDocument.activeElement;
  if (!isHTMLElement(focused)) return null;
  if (!scope.some((element) => element?.contains(focused))) return null;
  // The wrapper precedes the portal container, so concatenation keeps document order.
  const order = scope.flatMap((root) => [...(root?.querySelectorAll<HTMLElement>(tabbableSelector) ?? [])]);
  const after: HTMLElement[] = [];
  const before: HTMLElement[] = [];
  for (const element of order) {
    if (element === focused) continue;
    const position = focused.compareDocumentPosition(element);
    if (position & FOLLOWING) after.push(element);
    else if (position & PRECEDING) before.push(element);
  }
  const control = focused as Partial<HTMLInputElement>;
  let selection: [number, number] | undefined;
  try {
    if (typeof control.selectionStart === "number" && typeof control.selectionEnd === "number")
      selection = [control.selectionStart, control.selectionEnd];
  } catch {
    // An input type without a selection.
  }
  return { focused, selection, after, before };
}

/**
 * After the update: when the browser dropped focus with the removed element, focuses the nearest tabbable
 * successor, else the closest predecessor, else the wrapper. A connected element that a move blurred (an engine
 * without `moveBefore` re-inserts it) gets its focus and selection back, as React DOM does after a commit. A host or
 * a primitive that took focus during the update, inside the surface or not, stays where it is.
 */
export function restoreFocus(snapshot: FocusSnapshot | null, wrapper: HTMLElement | null): void {
  if (!snapshot) return;
  const { focused } = snapshot;
  const document = focused.ownerDocument;
  const active = document.activeElement;
  if (active && active !== document.body) return;
  if (focused.isConnected) {
    focused.focus({ preventScroll: true });
    const [start, end] = snapshot.selection ?? [];
    if (start !== undefined && end !== undefined && document.activeElement === focused)
      try {
        (focused as HTMLInputElement).setSelectionRange(start, end);
      } catch {
        // The control no longer has a selection.
      }
    return;
  }
  for (const candidate of [...snapshot.after, ...snapshot.before.slice().reverse()]) {
    if (!candidate.isConnected || !tabbableNow(candidate)) continue;
    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) return;
  }
  wrapper?.focus({ preventScroll: true });
}

/** Reports to the host's `onEvent`; a host's logger must never break rendering. */
export function notifyHost(onEvent: ((event: SurfaceEvent) => unknown) | undefined, event: SurfaceEvent): void {
  try {
    const settled = onEvent?.(Object.freeze(event));
    if (isThenable(settled)) settled.then(undefined, () => {});
  } catch {
    // Ignored, as the core ignores it.
  }
}

/**
 * Moves focus to the element of the tree's focus mark. The id resolves only to an element inside this
 * surface's wrapper or portal, so a mark can never reach another surface on the page (spec §11).
 */
export function moveFocus(
  nodeId: string,
  domIdPrefix: string,
  scope: FocusScope,
  onEvent: ((event: SurfaceEvent) => unknown) | undefined,
): void {
  const document = scope.find(Boolean)?.ownerDocument;
  const target = document?.getElementById(`${domIdPrefix}:${nodeId}`);
  if (!isHTMLElement(target) || !scope.some((root) => root?.contains(target))) {
    notifyHost(onEvent, { type: "focus-missed", nodeId, reason: "no-element" });
    return;
  }
  target.focus({ preventScroll: false });
  const active = target.ownerDocument.activeElement;
  if (active !== target && !target.contains(active))
    notifyHost(onEvent, { type: "focus-missed", nodeId, reason: "not-focusable" });
}

/**
 * The focus mark's memory for one surface. Call it after each commit that draws an accepted tree (undefined while
 * nothing valid is drawn): it calls `move` once for a later revision of the same surface whose mark changed, and
 * never for the first tree a surface draws. Calling it again with the same tree does nothing.
 */
export function createFocusMark(): (
  tree: UiTree | undefined,
  focus: string | undefined,
  move: (nodeId: string) => void,
) => void {
  let applied: { readonly surfaceId: string; readonly focus: string | undefined } | undefined;
  return (tree, focus, move) => {
    if (!tree) return;
    const previous = applied;
    applied = { surfaceId: tree.surfaceId, focus };
    if (focus !== undefined && previous?.surfaceId === tree.surfaceId && previous.focus !== focus) move(focus);
  };
}
