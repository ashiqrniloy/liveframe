import { frozenJsonCopy } from "../formats/json.ts";
import type { Intent, Json } from "../formats/tree.ts";

type SetStateIntent = Extract<Intent, { type: "setState" }>;
type ActionIntent = Extract<Intent, { type: "action" }>;
type LocalValues = Readonly<Record<string, Json>>;

function completeSetState(intent: SetStateIntent, value?: Json, local?: LocalValues): SetStateIntent {
  if (intent.fromLocal !== undefined) {
    const { fromLocal, ...state } = intent;
    const read = local && Object.hasOwn(local, fromLocal) ? local[fromLocal] : undefined;
    return read !== undefined ? { ...state, value: read } : state;
  }
  if (!Object.hasOwn(intent, "value") && value !== undefined) return { ...intent, value };
  return intent;
}

function completeAction(intent: ActionIntent, value?: Json, local?: LocalValues): ActionIntent {
  let args = intent.args;
  let action = intent;
  if (action.bind !== undefined && value !== undefined) {
    const { bind, ...rest } = action;
    action = rest;
    args = { ...args, [bind]: value };
  } else if (action.bindAll && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const { bindAll, ...rest } = action;
    action = rest;
    args = { ...args, ...(value as LocalValues) };
  }
  if (action.fromLocal !== undefined) {
    const { fromLocal, ...rest } = action;
    action = rest;
    const filled: Record<string, Json> = { ...args };
    for (const [arg, localKey] of Object.entries(fromLocal)) {
      const read = local && Object.hasOwn(local, localKey) ? local[localKey] : undefined;
      if (read !== undefined) filled[arg] = read;
    }
    args = filled;
  }
  return action !== intent || args !== intent.args ? { ...action, args } : intent;
}

export function complete(intent: Intent, value?: Json, local?: LocalValues): Intent {
  let result = intent;
  if (Object.hasOwn(result, "local")) {
    const { local: _local, ...rest } = result;
    result = rest as Intent;
  }
  result = result.type === "setState" ? completeSetState(result, value, local) : completeAction(result, value, local);
  return frozenJsonCopy(result);
}
