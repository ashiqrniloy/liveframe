import { jsx, primitive } from "@arnilo/liveframe/sdk";

/** One task as a line of text: the shared component the operator's library offers every widget. */
export function TaskRow({ title, status }: { title: string; status: string }) {
  return jsx(primitive("text"), { text: `${title} (${status})` });
}

/** The library's own gallery, which the preview and the host render like any widget. */
export default function Gallery() {
  return TaskRow({ title: "Write the report", status: "open" });
}
