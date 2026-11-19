// What an adapter hands an implementation, typed from its definition. Shared by `/react` and `/dom` (types only),
// so the two adapters type `props`, `emit` and `events` the same way.
import type { Definition, Infer, Json, LanguageSchema } from "../index.ts";

/** A definition's props, inferred; a wide definition reads any JSON props. */
export type Props<D extends Definition> = string extends keyof D["props"]["properties"]
  ? Record<string, Json>
  : Infer<D["props"]>;

/**
 * Raising an event returns a promise that settles when the host's does, when `onIntent` returns one,
 * so a primitive can mark itself busy until the host finishes; otherwise it returns `undefined`, as
 * in 0.2.1. The host's value is dropped, and a rejection is contained, never thrown to the page.
 */
export type Emit<D extends Definition> = string extends keyof D["events"]
  ? (event: string, value?: Json) => Promise<void> | undefined
  : (
      ...args: {
        [E in keyof D["events"] & string]: D["events"][E]["carries"] extends "string"
          ? [event: E, value: string]
          : D["events"][E]["carries"] extends "boolean"
            ? [event: E, value: boolean]
            : D["events"][E]["carries"] extends "number" | "integer"
              ? [event: E, value: number]
              : D["events"][E]["carries"] extends { readonly object: infer S extends LanguageSchema }
                ? [event: E, value: Infer<S>]
                : D["events"][E]["carries"] extends {
                      readonly array: { readonly items: infer I extends LanguageSchema };
                    }
                  ? [event: E, value: readonly Infer<I>[]]
                  : [event: E];
      }[keyof D["events"] & string]
    ) => Promise<void> | undefined;

/** What each of the node's events does, as an implementation may read it. */
export type Events<D extends Definition> = {
  readonly [E in keyof D["events"]]?: Readonly<{
    type: "action" | "setLocal" | "setState";
    confirm: boolean;
    irreversible: boolean;
  }>;
};
