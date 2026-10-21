import { assertJson, freeze } from "./data.ts";
import type { Intent, Json } from "./types.ts";

export const state = Object.freeze({
  set(key: string, value?: Json): Extract<Intent, { type: "setState" }> {
    const intent = value === undefined ? { type: "setState" as const, key } : { type: "setState" as const, key, value };
    assertJson(intent, "intent");
    return freeze(intent);
  },
});

export function action(name: string, args: Readonly<Record<string, Json>> = {}): Extract<Intent, { type: "action" }> {
  const intent = { type: "action" as const, name, args };
  assertJson(intent, "intent");
  return freeze(intent);
}
