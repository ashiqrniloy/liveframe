import { useState } from "react";

/** A host-owned value follows the incoming one when the widget sends a new one, and is local between renders. */
export function useValue<T>(incoming: T) {
  const [value, setValue] = useState(incoming);
  const [previous, setPrevious] = useState(incoming);
  if (previous !== incoming) {
    setPrevious(incoming);
    setValue(incoming);
  }
  return [value, setValue] as const;
}
