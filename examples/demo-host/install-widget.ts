import { readWidget } from "./widgets/draft.ts";

/** Install a widget directory on a running host: `bun install-widget.ts widgets/hello [http://127.0.0.1:3300]`. A directory with a template.json installs a template widget. */
const [dir, host = "http://127.0.0.1:3300"] = process.argv.slice(2);
if (!dir) {
  console.error("Usage: bun install-widget.ts <widget directory> [host url]");
  process.exit(2);
}
const response = await fetch(new URL("/widgets", host), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(await readWidget(dir)),
});
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
