// Progressive drawing of streamed element JSON (spec §7.2, plan 028 Task 7). One incremental JSON
// reader, and a driver that feeds `renderElements`'s own build steps (`streamBuild`) as nodes complete.

import type { LiveframeError, Result } from "../errors.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";
import type { CompiledValidator } from "../validate/compile.ts";
import { DEFAULT_LIMITS } from "../validate/tree.ts";
import type { Element } from "./element.ts";
import { Reject } from "./element-node.ts";
import { convertElement, convertShell, renderElements } from "./elements.ts";
import { type RenderLimits, type StreamBuild, type StreamNode, streamBuild } from "./render.ts";

export type StreamElementsOptions = {
  readonly validator: CompiledValidator;
  readonly surfaceId: string;
  /** The revision before the first tree: trees are numbered `revision + 1`, `revision + 2`, … (default 0). */
  readonly revision?: number;
  readonly limits?: RenderLimits;
  readonly maxErrors?: number;
};

export type ElementStream = {
  /**
   * Reads the next chunk of the JSON text. Returns a new tree when the nodes completed so far changed,
   * `undefined` when they did not, and the failure (the same one from then on) when the JSON is
   * malformed or a limit was reached.
   */
  push(chunk: string): Result<UiTree> | undefined;
  /** Ends the document: the result `renderElements` gives the whole text. */
  end(): Result<UiTree>;
};

/** Same bound as element JSON nesting in `renderElements`. */
const ELEMENT_DEPTH = 128;
/** JSON containers nested deeper than this are refused before any tree is built. */
const CONTAINER_DEPTH = 1024;
/** The reader keeps the document, so its size is bounded: a multiple of the tree's byte budget. */
const INPUT_FACTOR = 4;

// Reader states: what the next structural character must be.
const TOP = 0;
const DONE = 1;
const OBJECT_FIRST = 2;
const OBJECT_KEY = 3;
const OBJECT_COLON = 4;
const OBJECT_VALUE = 5;
const OBJECT_NEXT = 6;
const ARRAY_FIRST = 7;
const ARRAY_VALUE = 8;
const ARRAY_NEXT = 9;
// Token modes: a string, number or literal may span chunks.
const NONE = 0;
const STRING = 1;
const ESCAPE = 2;
const UNICODE = 3;
const NUMBER = 4;
const LITERAL = 5;
/** A value no element structure depends on, found by bracket matching and parsed natively. */
const RAW = 6;

const NUMBER_TEXT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ESCAPES: Readonly<Record<number, string>> = {
  34: '"',
  92: "\\",
  47: "/",
  98: "\b",
  102: "\f",
  110: "\n",
  114: "\r",
  116: "\t",
};

/** What the reader reports about the element objects it meets; the driver decides what to do. */
interface Sink<F> {
  /** An object at an element position: the root, or an entry of an element's `children` array. */
  element(object: Record<string, unknown>, parent: F | undefined): F;
  /** The `children` array of this element begins: every member written before it is known. */
  childrenStart(frame: F): void;
  /** A member arrived after `children` began, so the fields the children were built on may change. */
  late(frame: F): void;
  /** An entry of a `children` array that is not an object. */
  stray(owner: F): void;
  /** The element object closed. */
  closed(frame: F): void;
}

type Container<F> = {
  readonly value: Record<string, unknown> | unknown[];
  readonly parent: Container<F> | undefined;
  /** The element this object is, when it sits at an element position. */
  readonly element: F | undefined;
  /** The element whose `children` this array holds. */
  readonly owner: F | undefined;
  key: string;
  sawChildren: boolean;
};

function setMember(object: Record<string, unknown>, key: string, value: unknown): void {
  // `__proto__` is an ordinary member in JSON, as `JSON.parse` has it.
  if (key === "__proto__")
    Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
  else object[key] = value;
}

/** What the exact reader reports to when it only locates an error. */
const NO_SINK: Sink<object> = {
  element: (object) => object,
  childrenStart() {},
  late() {},
  stray() {},
  closed() {},
};

/**
 * An incremental JSON reader: linear in the input, nothing re-read. It builds the whole document
 * (the stream needs it to answer `end()` exactly) and tells the sink where element objects begin
 * and end. Only the element objects and their `children` arrays are read character by character:
 * every other container (props, style, events) is found by matching brackets and parsed by
 * `JSON.parse`, and the exact reader runs over it only to name the offset of an error.
 */
class Reader<F> {
  error: LiveframeError | undefined;
  root: unknown;
  private base = 0;
  private state = TOP;
  private token = NONE;
  private text = "";
  private isKey = false;
  private hex = 0;
  private hexDigits = 0;
  private current: Container<F> | undefined;
  private depth = 0;
  private rawDepth = 0;
  private rawStart = 0;
  private inString = false;
  private escaped = false;
  private readonly sink: Sink<F>;
  private readonly maxChars: number;
  private readonly exact: boolean;

  constructor(sink: Sink<F>, maxChars: number, exact = false, base = 0) {
    this.sink = sink;
    this.maxChars = maxChars;
    this.exact = exact;
    this.base = base;
  }

  feed(chunk: string): void {
    if (this.error) return;
    const n = chunk.length;
    if (this.base + n > this.maxChars) {
      this.fail("limit-exceeded", this.maxChars, `a document of at most ${this.maxChars} characters`);
      return;
    }
    let i = 0;
    while (i < n && !this.error) {
      if (this.token !== NONE) {
        i = this.continueToken(chunk, i);
        continue;
      }
      const c = chunk.charCodeAt(i);
      if (c === 34 && this.state !== OBJECT_COLON) {
        // A string that sits whole in this chunk needs no token state.
        const end = this.closingQuote(chunk, i);
        if (end > 0) {
          const key = this.state === OBJECT_FIRST || this.state === OBJECT_KEY;
          if (key || this.valueExpected()) {
            this.stringDone(chunk.slice(i + 1, end), key);
            i = end + 1;
            continue;
          }
        }
      }
      if (c !== 32 && c !== 10 && c !== 13 && c !== 9) this.structural(c, this.base + i);
      i++;
    }
    this.base += n;
  }

  /** The end of input: a number or literal may end the document, anything else open is an error. */
  finish(): void {
    if (this.error) return;
    if (this.token === NUMBER) this.endNumber(this.base);
    else if (this.token === LITERAL) this.endLiteral(this.base);
    else if (this.token !== NONE) this.fail("invalid-document", this.base, "a complete value");
    if (!this.error && this.state !== DONE) this.fail("invalid-document", this.base, "a complete JSON document");
  }

  private fail(kind: "invalid-document" | "limit-exceeded", offset: number, expected: string): void {
    this.error = { kind, pointer: `/$stream/${offset}`, expected, message: `Expected ${expected}` };
  }

  private structural(c: number, offset: number): void {
    switch (this.state) {
      case TOP:
      case OBJECT_VALUE:
      case ARRAY_VALUE:
        this.startValue(c, offset);
        break;
      case ARRAY_FIRST:
        if (c === 93) this.closeArray();
        else this.startValue(c, offset);
        break;
      case OBJECT_FIRST:
        if (c === 125) this.closeObject();
        else this.startKey(c, offset);
        break;
      case OBJECT_KEY:
        this.startKey(c, offset);
        break;
      case OBJECT_COLON:
        if (c === 58) this.state = OBJECT_VALUE;
        else this.fail("invalid-document", offset, "a colon after the property name");
        break;
      case OBJECT_NEXT:
        if (c === 44) this.state = OBJECT_KEY;
        else if (c === 125) this.closeObject();
        else this.fail("invalid-document", offset, "a comma or a closing brace");
        break;
      case ARRAY_NEXT:
        if (c === 44) this.state = ARRAY_VALUE;
        else if (c === 93) this.closeArray();
        else this.fail("invalid-document", offset, "a comma or a closing bracket");
        break;
      default:
        this.fail("invalid-document", offset, "the end of the document");
    }
  }

  private startKey(c: number, offset: number): void {
    if (c !== 34) {
      this.fail("invalid-document", offset, "a property name");
      return;
    }
    this.token = STRING;
    this.isKey = true;
    this.text = "";
  }

  /** Whether the container starting here is an element object or a `children` array, which the stream follows. */
  private followed(c: number): boolean {
    const parent = this.current;
    if (this.exact) return true;
    if (c === 123) return !parent || parent.owner !== undefined;
    return parent?.element !== undefined && parent.key === "children";
  }

  private startValue(c: number, offset: number): void {
    if ((c === 123 || c === 91) && !this.followed(c)) {
      if (c === 91 && this.current?.owner !== undefined) this.sink.stray(this.current.owner);
      this.token = RAW;
      this.text = String.fromCharCode(c);
      this.rawDepth = 1;
      this.rawStart = offset;
      this.inString = this.escaped = false;
    } else if (c === 123) this.openObject(offset);
    else if (c === 91) this.openArray(offset);
    else if (c === 34) {
      this.token = STRING;
      this.isKey = false;
      this.text = "";
    } else if (c === 45 || (c >= 48 && c <= 57)) {
      this.token = NUMBER;
      this.text = String.fromCharCode(c);
    } else if (c === 116 || c === 102 || c === 110) {
      this.token = LITERAL;
      this.text = String.fromCharCode(c);
    } else this.fail("invalid-document", offset, "a JSON value");
  }

  private nest(offset: number): boolean {
    if (++this.depth <= CONTAINER_DEPTH) return true;
    this.fail("limit-exceeded", offset, `JSON nested at most ${CONTAINER_DEPTH} deep`);
    return false;
  }

  private openObject(offset: number): void {
    if (!this.nest(offset)) return;
    const parent = this.current;
    const value: Record<string, unknown> = {};
    let element: F | undefined;
    if (!parent) element = this.sink.element(value, undefined);
    else if (parent.owner !== undefined) element = this.sink.element(value, parent.owner);
    this.current = { value, parent, element, owner: undefined, key: "", sawChildren: false };
    this.state = OBJECT_FIRST;
  }

  private openArray(offset: number): void {
    if (!this.nest(offset)) return;
    const parent = this.current;
    let owner: F | undefined;
    if (parent?.owner !== undefined) this.sink.stray(parent.owner);
    else if (parent?.element !== undefined && parent.key === "children" && !Array.isArray(parent.value)) {
      owner = parent.element;
      parent.sawChildren = true;
      this.sink.childrenStart(owner);
    }
    this.current = { value: [], parent, element: undefined, owner, key: "", sawChildren: false };
    this.state = ARRAY_FIRST;
  }

  private closeObject(): void {
    const container = this.current as Container<F>;
    this.depth--;
    this.current = container.parent;
    if (container.element !== undefined) this.sink.closed(container.element);
    this.deliver(container.value);
  }

  private closeArray(): void {
    const container = this.current as Container<F>;
    this.depth--;
    this.current = container.parent;
    this.deliver(container.value);
  }

  private deliver(value: unknown): void {
    const container = this.current;
    if (!container) {
      this.root = value;
      this.state = DONE;
    } else if (Array.isArray(container.value)) {
      if (container.owner !== undefined && (value === null || typeof value !== "object"))
        this.sink.stray(container.owner);
      container.value.push(value);
      this.state = ARRAY_NEXT;
    } else {
      setMember(container.value as Record<string, unknown>, container.key, value);
      this.state = OBJECT_NEXT;
    }
  }

  /** Continues the token the last chunk ended in, from `i`; returns where reading goes on. */
  private continueToken(chunk: string, i: number): number {
    const n = chunk.length;
    switch (this.token) {
      case STRING:
        return this.scanString(chunk, i);
      case RAW:
        return this.scanRaw(chunk, i);
      case ESCAPE: {
        const c = chunk.charCodeAt(i);
        if (c === 117) {
          this.token = UNICODE;
          this.hex = 0;
          this.hexDigits = 0;
        } else {
          const escaped = ESCAPES[c];
          if (escaped === undefined) {
            this.fail("invalid-document", this.base + i, "a valid escape");
            return n;
          }
          this.text += escaped;
          this.token = STRING;
        }
        return i + 1;
      }
      case UNICODE: {
        let j = i;
        while (j < n && this.hexDigits < 4) {
          const c = chunk.charCodeAt(j);
          const digit = c >= 48 && c <= 57 ? c - 48 : c >= 97 && c <= 102 ? c - 87 : c >= 65 && c <= 70 ? c - 55 : -1;
          if (digit < 0) {
            this.fail("invalid-document", this.base + j, "four hexadecimal digits");
            return n;
          }
          this.hex = this.hex * 16 + digit;
          this.hexDigits++;
          j++;
        }
        if (this.hexDigits === 4) {
          this.text += String.fromCharCode(this.hex);
          this.token = STRING;
        }
        return j;
      }
      default:
        return this.scanWord(chunk, i);
    }
  }

  /** Matches brackets, skipping strings, until the container that started the token closes. */
  private scanRaw(chunk: string, start: number): number {
    const n = chunk.length;
    let { rawDepth: depth, inString, escaped } = this;
    for (let i = start; i < n; i++) {
      const c = chunk.charCodeAt(i);
      if (inString) {
        if (escaped) escaped = false;
        else if (c === 92) escaped = true;
        else if (c === 34) inString = false;
      } else if (c === 34) inString = true;
      else if (c === 123 || c === 91) {
        if (++depth > CONTAINER_DEPTH) {
          this.fail("limit-exceeded", this.base + i, `JSON nested at most ${CONTAINER_DEPTH} deep`);
          return n;
        }
      } else if ((c === 125 || c === 93) && --depth === 0) {
        this.text += chunk.slice(start, i + 1);
        this.token = NONE;
        this.endRaw();
        return i + 1;
      }
    }
    this.rawDepth = depth;
    this.inString = inString;
    this.escaped = escaped;
    this.text += chunk.slice(start);
    return n;
  }

  private endRaw(): void {
    let value: unknown;
    try {
      value = JSON.parse(this.text);
    } catch {
      // Native parsing says only that the text is wrong; the exact reader says where.
      const exact = new Reader<object>(NO_SINK, Number.POSITIVE_INFINITY, true, this.rawStart);
      exact.feed(this.text);
      exact.finish();
      this.error = exact.error ?? {
        kind: "invalid-document",
        pointer: `/$stream/${this.rawStart}`,
        expected: "valid JSON",
        message: "Expected valid JSON",
      };
      return;
    }
    this.deliver(value);
  }

  private scanString(chunk: string, start: number): number {
    const n = chunk.length;
    for (let i = start; i < n; i++) {
      const c = chunk.charCodeAt(i);
      if (c === 34) {
        this.text += chunk.slice(start, i);
        this.token = NONE;
        this.endString();
        return i + 1;
      }
      if (c === 92) {
        this.text += chunk.slice(start, i);
        this.token = ESCAPE;
        return i + 1;
      }
      if (c < 32) {
        this.fail("invalid-document", this.base + i, "no raw control character in a string");
        return n;
      }
    }
    this.text += chunk.slice(start);
    return n;
  }

  private endString(): void {
    this.stringDone(this.text, this.isKey);
  }

  /** A property name or a string value is complete. */
  private stringDone(text: string, key: boolean): void {
    if (!key) {
      this.deliver(text);
      return;
    }
    const container = this.current as Container<F>;
    container.key = text;
    if (container.element !== undefined && container.sawChildren) this.sink.late(container.element);
    this.state = OBJECT_COLON;
  }

  private valueExpected(): boolean {
    const { state } = this;
    return state === TOP || state === OBJECT_VALUE || state === ARRAY_FIRST || state === ARRAY_VALUE;
  }

  /** The closing quote of the string opening at `start`, when it is in this chunk with no escape or control character. */
  private closingQuote(chunk: string, start: number): number {
    for (let j = start + 1; j < chunk.length; j++) {
      const c = chunk.charCodeAt(j);
      if (c === 34) return j;
      if (c === 92 || c < 32) return -1;
    }
    return -1;
  }

  /** A number or literal runs until a character that cannot be part of it. */
  private scanWord(chunk: string, start: number): number {
    const n = chunk.length;
    const number = this.token === NUMBER;
    let i = start;
    for (; i < n; i++) {
      const c = chunk.charCodeAt(i);
      const part = number
        ? (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46 || c === 101 || c === 69
        : c >= 97 && c <= 122;
      if (!part) break;
    }
    this.text += chunk.slice(start, i);
    if (i < n) {
      if (number) this.endNumber(this.base + i);
      else this.endLiteral(this.base + i);
    }
    return i;
  }

  private endNumber(offset: number): void {
    this.token = NONE;
    if (!NUMBER_TEXT.test(this.text)) this.fail("invalid-document", offset - this.text.length, "a JSON number");
    else this.deliver(Number(this.text));
  }

  private endLiteral(offset: number): void {
    this.token = NONE;
    if (this.text === "true") this.deliver(true);
    else if (this.text === "false") this.deliver(false);
    else if (this.text === "null") this.deliver(null);
    else this.fail("invalid-document", offset - this.text.length, "true, false or null");
  }
}

/** One element object as the stream sees it. */
type Frame = {
  readonly object: Record<string, unknown>;
  readonly parent: Frame | undefined;
  /** The root is level 1, as in `renderElements`. */
  readonly depth: number;
  /** Whether the element sits on the path the stream draws: every ancestor was opened as a shell. */
  readonly live: boolean;
  /** Set once the element's own fields were final and it was opened, before its children. */
  opened: Opened | undefined;
  /** The element could not be opened (an error was recorded), so nothing under it is drawn. */
  skip: boolean;
};

/** An element in progress: its build node, and the children completed so far that may be drawn. */
type Opened = { readonly open: StreamNode; readonly shown: UiNode[]; readonly counts: Map<string, number> };

class Stream implements Sink<Frame> {
  private readonly options: StreamElementsOptions;
  private readonly reader: Reader<Frame>;
  private readonly build: StreamBuild | undefined;
  private readonly reject = new Reject(1);
  private readonly pointers = new WeakMap<Element, string>();
  /** The elements opened and not yet closed, outermost first. */
  private readonly chain: Opened[] = [];
  private result: Result<UiTree> | undefined;
  private revision: number;
  private rootNode: UiNode | undefined;
  private rootPlaced = false;
  private changed = false;
  /** Something was invalid: the drawn trees stay valid, and `end()` reports through `renderElements`. */
  private dirty = false;
  /** A member followed `children`, so the opened shells may be wrong: nothing more is drawn. */
  private poisoned = false;

  constructor(options: StreamElementsOptions) {
    this.options = options;
    this.revision = options.revision ?? 0;
    const { revision: _start, ...rest } = options;
    const built = streamBuild({ ...rest, revision: this.revision + 1 });
    if (Array.isArray(built)) this.result = { ok: false, errors: built };
    else this.build = built;
    this.reader = new Reader<Frame>(this, INPUT_FACTOR * (options.limits?.bytes ?? DEFAULT_LIMITS.bytes));
  }

  push(chunk: string): Result<UiTree> | undefined {
    if (this.result) return this.result;
    this.reader.feed(chunk);
    return this.fatal() ?? this.snapshot();
  }

  end(): Result<UiTree> {
    if (this.result) return this.result;
    this.reader.finish();
    this.result = this.fatal() ?? this.conclude();
    return this.result;
  }

  // What the reader tells the stream about the elements it meets.

  element(object: Record<string, unknown>, parent: Frame | undefined): Frame {
    return {
      object,
      parent,
      depth: parent ? parent.depth + 1 : 1,
      live: parent === undefined || parent.opened !== undefined,
      opened: undefined,
      skip: false,
    };
  }

  childrenStart(frame: Frame): void {
    const { build } = this;
    if (!build || !frame.live || this.poisoned) return;
    const { kind } = frame.object;
    // A fragment draws nothing of its own, and a node nested this deep is an error `end()` reports.
    if (typeof kind !== "string" || kind === "fragment" || frame.depth >= ELEMENT_DEPTH) return;
    const element = this.checked(convertShell(frame.object, "", this.reject, this.pointers));
    const open = element && build.open(element, frame.parent?.opened?.open ?? null);
    if (!open) {
      this.dirty = frame.skip = true;
      return;
    }
    frame.opened = { open, shown: [], counts: new Map() };
    this.chain.push(frame.opened);
  }

  late(frame: Frame): void {
    if (frame.opened) this.poisoned = true;
  }

  stray(): void {
    this.dirty = true;
  }

  closed(frame: Frame): void {
    const { build } = this;
    if (!build || !frame.live || frame.skip || this.poisoned) return;
    const parentOpen = frame.parent?.opened?.open ?? null;
    let placed: ReturnType<StreamBuild["close"]>;
    if (frame.opened) {
      this.chain.pop();
      placed = build.close(frame.opened.open);
    } else {
      const element = this.checked(convertElement(frame.object, "", frame.depth, this.reject, this.pointers));
      placed = element && build.whole(element, parentOpen);
    }
    if (!placed) {
      this.dirty = true;
      return;
    }
    // Nodes still waiting on a reference are drawn when the document ends.
    if (frame.parent) {
      const parent = frame.parent.opened;
      if (parent && !placed.references)
        for (const node of placed.nodes) {
          parent.shown.push(node);
          parent.counts.set(node.kind, (parent.counts.get(node.kind) ?? 0) + 1);
        }
    } else {
      this.rootPlaced = true;
      if (!placed.references) this.rootNode = placed.nodes[0];
    }
    this.changed = true;
  }

  // The stream's own steps.

  /** A conversion's element, or undefined when it recorded any error. */
  private checked<T>(converted: T | undefined): T | undefined {
    const clean = this.reject.errors.length === 0;
    this.reject.errors.length = 0;
    this.reject.stopped = false;
    return clean ? converted : undefined;
  }

  /** A malformed document or a stopped build ends the stream where it is. */
  private fatal(): Result<UiTree> | undefined {
    const { error } = this.reader;
    if (error) this.result = { ok: false, errors: [error] };
    else if (this.build?.stopped) this.result = { ok: false, errors: this.build.failure() };
    return this.result;
  }

  /** The tree of the nodes completed so far: each open shell around its drawn children, innermost first. */
  private snapshot(): Result<UiTree> | undefined {
    const { build } = this;
    if (!build || !this.changed || this.poisoned) return undefined;
    this.changed = false;
    let child: UiNode | undefined;
    for (let k = this.chain.length - 1; k >= 0; k--) {
      const { open, shown, counts } = this.chain[k] as Opened;
      if (child) {
        counts.set(child.kind, (counts.get(child.kind) ?? 0) + 1);
        const children = shown.slice();
        children.push(child);
        const shell = build.shell(open, children, counts);
        counts.set(child.kind, (counts.get(child.kind) as number) - 1);
        child = shell;
      } else child = build.shell(open, shown.slice(), counts);
    }
    const root = this.chain.length ? child : this.rootNode;
    return root ? { ok: true, value: build.tree(root, ++this.revision) } : undefined;
  }

  private conclude(): Result<UiTree> {
    const revision = ++this.revision;
    if (this.build && this.rootPlaced && !this.dirty && !this.poisoned) return this.build.finish(revision);
    const { revision: _start, ...rest } = this.options;
    return renderElements(this.reader.root, { ...rest, revision });
  }
}

/**
 * Draws agent element JSON while it is still arriving (spec §7.2). Feed it chunks of the JSON text;
 * after each it returns a valid tree of the nodes completed so far — a node whose object closed
 * and passed the same checks `renderElements` makes, and the shells of the nodes still open, once
 * their own fields are in. Trees are numbered upward from `revision`, so a host can send
 * `diffTrees(previous, next)` patches. `end()` returns what `renderElements` returns for the whole
 * text.
 *
 * Progressive drawing needs an element's `children` to come after its other members, which is how
 * `generateElementsSchema` orders them; a member after `children` ends it and `end()` still gives
 * the right answer. An invalid node is left out of the trees and reported by `end()`. A node that
 * carries a `$ref` is drawn when the document ends, once the reference can be resolved.
 */
export function streamElements(options: StreamElementsOptions): ElementStream {
  const stream = new Stream(options);
  return { push: (chunk) => stream.push(chunk), end: () => stream.end() };
}
