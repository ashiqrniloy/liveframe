// Deno child with every permission denied (`--no-prompt --deny-read --deny-write --deny-net --deny-env --deny-run --deny-ffi --deny-sys`): renders through the runner-kit bundle loaded as a data: module. Line-delimited JSON on stdio.
let kitUrl = "";
let kitMod: any;
const buf: string[] = [];
const write = (o: unknown) => Deno.stdout.writeSync(new TextEncoder().encode(JSON.stringify(o) + "\n"));
for await (const chunk of Deno.stdin.readable.pipeThrough(new TextDecoderStream())) {
  buf.push(chunk);
  const text = buf.join("");
  buf.length = 0;
  const lines = text.split("\n");
  buf.push(lines.pop()!);
  for (const line of lines) {
    const m = JSON.parse(line);
    if (m.type === "init") {
      kitUrl = m.kitUrl;
      kitMod = await import(kitUrl);
      write({ type: "ready" });
      continue;
    }
    try {
      const mod = await import(m.pkgUrl);
      const q = JSON.parse(m.request);
      write({ type: "result", id: m.id, json: JSON.stringify(kitMod.renderModule(mod.default, q.inputs, q.options)) });
    } catch (e) {
      write({ type: "result", id: m.id, error: String((e as Error)?.message ?? e) });
    }
  }
}
