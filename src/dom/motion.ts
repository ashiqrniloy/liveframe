/**
 * Design-system motion in the DOM (spec §6.2, §11). The projection decides
 * what moves: a root slot's rest recipe sets `--lf-m` (`fade`, `move` or `fade-move`) with its own
 * transition duration and easing, and the enter and exit rules apply once a surface carries
 * `data-lf-motion`. This module does what CSS alone cannot: it marks the surface after its first drawn
 * tree, keeps a removed element until its exit has played, and slides moved siblings from their old
 * boxes (FLIP). Exit and move run as Web Animations timed by the recipe's computed transition. The commit
 * itself only reads the style and boxes the last frame computed; the rest runs in the next animation frame,
 * before it is styled, laid out or painted, so it forces no layout of its own. It finds elements only by `domId`
 * inside the surface, assigns no names and animates only numbers it measured.
 *
 * Framework-free and internal: `/react` calls it around its commit, and `/dom` around its own mutation.
 */

/** The part of a core node context this module reads. `NodeContext` satisfies it. */
export type MotionNode = {
  readonly id: string;
  readonly domId: string;
  readonly items: readonly MotionNode[];
};

/** The surface's wrapper first, then its portal container. */
export type MotionScope = readonly (Element | null)[];

/** The recipe's transition timing for one element, read from its computed style. */
type Timing = { readonly duration: number; readonly delay: number; readonly easing: string };
type Exit = {
  readonly element: HTMLElement;
  readonly parent: Node;
  readonly next: Node | null;
  readonly opacity: string;
  readonly timing: Timing;
};
type Move = { readonly element: HTMLElement; readonly box: DOMRect; readonly timing: Timing };

/** What `before` measured, for `after` to act on once the commit has run. */
export type MotionPlan = {
  readonly scope: MotionScope;
  readonly exits: readonly Exit[];
  readonly moves: readonly Move[];
  /** `domId`s the new tree draws again: an element still exiting under one of them goes at once. */
  readonly entered: ReadonlySet<string>;
};

export type Motion = {
  /**
   * After the commit that first draws a tree: style it, then mark the surface so later inserts enter.
   * Marks only the scope roots not yet marked, so it may run after every commit.
   */
  gate(scope: MotionScope, identity: string): void;
  /** Before a commit: the pre-commit reads, or undefined when nothing can move. */
  before(
    previous: MotionNode | undefined,
    next: MotionNode | undefined,
    scope: MotionScope,
    identity: string,
  ): MotionPlan | undefined;
  /**
   * After the commit: ends exits the new tree superseded, then plays the plan in the next animation frame,
   * before that frame is styled, laid out or painted.
   */
  after(plan: MotionPlan | undefined): void;
  /** A style switch is starting (spec §6.4): no motion plays, so every exit and move ends now. */
  halt(): void;
  /** The surface is going: unmark it and end every exit and move now. */
  dispose(scope: MotionScope): void;
};

const MARK = "data-lf-motion";
const EXITING = "data-lf-exiting";
const STAY = "data-lf-stay";

/** The element of a `domId`, only when it lies inside this surface. */
function find(domId: string, scope: MotionScope): HTMLElement | undefined {
  const element = scope.find(Boolean)?.ownerDocument.getElementById(domId);
  return element && "style" in element && scope.some((root) => root?.contains(element))
    ? (element as HTMLElement)
    : undefined;
}

const milliseconds = (value = "") => Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000) || 0;

/**
 * The first entry of the computed transition lists: the projection writes one duration and one easing for
 * every transitioned property. Reduced motion and the switching sequence compute a zero duration.
 */
function timing(style: CSSStyleDeclaration): Timing {
  return {
    duration: milliseconds(style.transitionDuration.split(",")[0]),
    delay: milliseconds(style.transitionDelay.split(",")[0]),
    easing: style.transitionTimingFunction.split(/,(?![^(]*\))/)[0]?.trim() || "ease",
  };
}

/**
 * Walks the drawn trees together. Unchanged contexts are the same object (the core shares them), so an
 * unchanged subtree costs one comparison. A parent whose child-id sequence changed is recorded once.
 */
function diff(
  previous: MotionNode,
  next: MotionNode,
  removed: MotionNode[],
  changed: [MotionNode, MotionNode][],
  entered: Set<string>,
): void {
  if (previous === next) return;
  const before = previous.items;
  const after = next.items;
  const kept = new Map<string, MotionNode>();
  for (const item of before) kept.set(item.id, item);
  let same = before.length === after.length;
  for (const [i, item] of after.entries()) {
    if (before[i]?.id !== item.id) same = false;
    const old = kept.get(item.id);
    if (old) {
      kept.delete(item.id);
      diff(old, item, removed, changed, entered);
    } else entered.add(item.domId);
  }
  for (const item of kept.values()) removed.push(item);
  if (!same) changed.push([previous, next]);
}

/** The removed elements that fade out, read before the commit detaches them. */
function exitsOf(removed: readonly MotionNode[], scope: MotionScope): Exit[] {
  const exits: Exit[] = [];
  for (const node of removed) {
    const element = find(node.domId, scope);
    const parent = element?.parentNode;
    if (!element || !parent) continue;
    const style = getComputedStyle(element);
    if (!style.getPropertyValue("--lf-m").includes("fade")) continue;
    const time = timing(style);
    // Reduced motion and switching compute a zero duration: the element goes at once.
    if (time.duration > 0)
      exits.push({ element, parent, next: element.nextSibling, opacity: style.opacity, timing: time });
  }
  return exits;
}

/**
 * For each parent whose children changed, the staying children that slide (with their boxes now) and the
 * staying children that fade and are not yet marked `data-lf-stay`.
 */
function staying(
  changed: readonly [MotionNode, MotionNode][],
  scope: MotionScope,
): { readonly moves: Move[]; readonly stays: HTMLElement[] } {
  const moves: Move[] = [];
  const stays: HTMLElement[] = [];
  for (const [old, now] of changed) {
    const ids = new Set(old.items.map((item) => item.id));
    for (const item of now.items) {
      const element = ids.has(item.id) ? find(item.domId, scope) : undefined;
      if (!element) continue;
      const style = getComputedStyle(element);
      const motion = style.getPropertyValue("--lf-m");
      if (motion.includes("fade") && !element.hasAttribute(STAY)) stays.push(element);
      const time = motion.includes("move") ? timing(style) : undefined;
      if (time && time.duration > 0) moves.push({ element, box: element.getBoundingClientRect(), timing: time });
    }
  }
  return { moves, stays };
}

export function createMotion(): Motion {
  /** Whether a design system projects any motion, per `id@version`: one style read each. */
  const uses = new Map<string, boolean>();
  /** Exiting elements and the call that removes each one at once. */
  const exiting = new Map<HTMLElement, () => void>();
  /** The slide running on each element, cancelled before it is measured again. */
  const sliding = new Map<HTMLElement, Animation>();
  /** The plan of the last commit, played in the next animation frame, and that frame's request. */
  let pending: MotionPlan | undefined;
  let frame: { readonly view: Window; readonly id: number } | undefined;

  /** Plays the pending plan: puts kept elements back, fades them out and slides the moved ones. */
  function settle(): void {
    const plan = pending;
    pending = undefined;
    frame = undefined;
    if (!plan) return;
    const kept: Exit[] = [];
    // Last first, so an element's recorded next sibling, if it was removed too, is already back.
    for (const exit of [...plan.exits].reverse()) {
      const { element, parent, next } = exit;
      if (element.isConnected || !parent.isConnected || find(element.id, plan.scope)) continue;
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
      element.setAttribute(EXITING, "");
      parent.insertBefore(element, next?.parentNode === parent ? next : null);
      kept.push(exit);
    }
    for (const exit of kept) fade(exit);
    slide(plan.moves);
  }

  function using(scope: MotionScope, identity: string): boolean {
    const known = uses.get(identity);
    if (known !== undefined) return known;
    const wrapper = scope[0];
    const answer = wrapper ? getComputedStyle(wrapper).getPropertyValue("--lf-motion").trim() === "1" : false;
    uses.set(identity, answer);
    return answer;
  }

  /** Slides each element from its recorded box to where it is now, over the recipe's own timing. */
  function slide(moves: readonly Move[]): void {
    for (const { element } of moves) sliding.get(element)?.cancel();
    // Every read before any write, so layout is computed once.
    const deltas = moves.map(({ element, box }) => {
      if (!element.isConnected) return undefined;
      const now = element.getBoundingClientRect();
      return [box.left - now.left, box.top - now.top] as const;
    });
    for (const [i, delta] of deltas.entries()) {
      const move = moves[i];
      if (!move || !delta || (Math.abs(delta[0]) < 0.5 && Math.abs(delta[1]) < 0.5)) continue;
      const { element, timing } = move;
      // Added to the recipe's own `translate`, so a pressed offset is kept.
      const animation = element.animate([{ translate: `${delta[0]}px ${delta[1]}px` }, { translate: "0px 0px" }], {
        ...timing,
        composite: "add",
      });
      sliding.set(element, animation);
      animation.finished.then(
        () => sliding.get(element) === animation && sliding.delete(element),
        () => {},
      );
    }
  }

  /** The siblings a removal moves, measured before it. */
  function moving(parent: Element, except: Element): Move[] {
    const moves: Move[] = [];
    for (const child of parent.children) {
      if (child === except || !("style" in child)) continue;
      const style = getComputedStyle(child);
      if (!style.getPropertyValue("--lf-m").includes("move")) continue;
      const time = timing(style);
      if (time.duration > 0)
        moves.push({ element: child as HTMLElement, box: child.getBoundingClientRect(), timing: time });
    }
    return moves;
  }

  /** Removes a kept element; its siblings that move close the gap it leaves. */
  function remove(element: HTMLElement, animate: boolean): void {
    exiting.delete(element);
    const parent = element.parentElement;
    const siblings = animate && parent ? moving(parent, element) : [];
    element.remove();
    slide(siblings);
  }

  /** Fades a kept element out over its recipe's timing, then removes it. */
  function fade({ element, opacity, timing }: Exit): void {
    const animation = element.animate([{ opacity }, { opacity: "0" }], { ...timing, fill: "forwards" });
    const end = () => {
      if (exiting.has(element)) remove(element, true);
    };
    animation.finished.then(end, end);
    exiting.set(element, () => {
      exiting.delete(element);
      animation.cancel();
      remove(element, false);
    });
  }

  return {
    gate(scope, identity) {
      const unmarked = scope.filter((root): root is Element => root !== null && !root.hasAttribute(MARK));
      if (!unmarked.length) return;
      const wrapper = scope[0];
      // The first tree is styled before the mark, so `@starting-style` never plays for it.
      if (wrapper && using(scope, identity) && "offsetWidth" in wrapper) void (wrapper as HTMLElement).offsetWidth;
      for (const root of unmarked) root.setAttribute(MARK, "");
    },

    before(previous, next, scope, identity) {
      if (!previous || !next || previous === next) return undefined;
      // A second commit in the same frame plays the first one's plan now, so its reads see those rows.
      if (pending) {
        if (frame) frame.view.cancelAnimationFrame(frame.id);
        settle();
      }
      const removed: MotionNode[] = [];
      const changed: [MotionNode, MotionNode][] = [];
      const entered = new Set<string>();
      diff(previous, next, removed, changed, entered);
      const returning = [...exiting.keys()].some((element) => entered.has(element.id));
      if (!removed.length && !changed.length && !returning) return undefined;
      if (!using(scope, identity)) return returning ? { scope, exits: [], moves: [], entered } : undefined;
      // Reads first, against the style the last frame computed.
      const exits = exitsOf(removed, scope);
      const { moves, stays } = staying(changed, scope);
      // Then the only write: a framework reorders by re-inserting an element, which restarts its style, and
      // the projected enter rule skips `data-lf-stay`, so a row that only moved never fades in again. The
      // mark stays: the element's only later re-insertion is another reorder.
      for (const element of stays) element.setAttribute(STAY, "");
      return { scope, exits, moves, entered };
    },

    after(plan) {
      if (!plan) return;
      for (const [element, finish] of [...exiting]) if (plan.entered.has(element.id) || !element.isConnected) finish();
      if (!plan.exits.length && !plan.moves.length) return;
      // The rest waits for the next frame's callbacks, which run before its style, layout and paint: the
      // removed rows are back before anything is drawn, and measuring the moved boxes costs the layout the
      // frame does anyway instead of one forced inside the commit.
      pending = plan;
      const view = plan.scope.find(Boolean)?.ownerDocument.defaultView;
      if (view) frame = { view, id: view.requestAnimationFrame(settle) };
      else settle();
    },

    halt() {
      // A pending plan is dropped unplayed: its removed elements stay removed.
      if (frame) frame.view.cancelAnimationFrame(frame.id);
      pending = undefined;
      frame = undefined;
      for (const finish of [...exiting.values()]) finish();
      for (const animation of [...sliding.values()]) animation.cancel();
      sliding.clear();
    },

    dispose(scope) {
      this.halt();
      for (const root of scope) root?.removeAttribute(MARK);
    },
  };
}
