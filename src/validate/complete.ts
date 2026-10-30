import { frozenJsonCopy } from "../formats/json.ts";
import type { Intent, Json } from "../formats/tree.ts";

export function complete(intent: Intent, value?: Json): Intent {
  let result = intent;
  if (result.type === "setState" && !Object.hasOwn(result, "value") && value !== undefined)
    result = { ...result, value };
  else if (result.type === "action" && result.bind !== undefined && value !== undefined) {
    const { bind, ...action } = result;
    result = { ...action, args: { ...action.args, [bind]: value } };
  } else if (
    result.type === "action" &&
    result.bindAll &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const { bindAll, ...action } = result;
    result = { ...action, args: { ...action.args, ...(value as Readonly<Record<string, Json>>) } };
  }
  return frozenJsonCopy(result);
}
