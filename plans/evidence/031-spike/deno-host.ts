import { readFileSync } from "node:fs";
import { validateCapabilities, validateCatalog } from "../../../src/index.ts";
import { pack } from "../../../src/pack/index.ts";
import { linkPackage } from "../../../src/runner-kit/index.ts";
import catalogDoc from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "../../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../../src/__tests__/fixtures/widgets/index.ts";
const ok = <T>(r: any): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const catalog = ok<any>(validateCatalog(catalogDoc)),
  capabilities = ok<any>(validateCapabilities(capabilitiesDoc));
const pkg = ok<any>(pack(drafts[0] as never, { catalog, capabilities }));
const kit = readFileSync(new URL("../../../dist/runner-kit.bundle.js", import.meta.url), "utf8");
const dataUrl = (s: string) => "data:text/javascript," + encodeURIComponent(s);
const kitUrl = dataUrl(kit);
const request = JSON.stringify({
  inputs: proofWidgets[0]!.scenarios[0],
  options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "s", revision: 1 },
});
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
const deno = new URL("./node_modules/.bin/deno", import.meta.url).pathname;
const args = [
  "run",
  "--no-prompt",
  "--deny-read",
  "--deny-write",
  "--deny-net",
  "--deny-env",
  "--deny-run",
  "--deny-ffi",
  "--deny-sys",
  "--v8-flags=--max-old-space-size=512",
  new URL("./deno-child.ts", import.meta.url).pathname,
];

class Child {
  proc = Bun.spawn([deno, ...args], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  waiting = new Map<string, (m: any) => void>();
  ready!: () => void;
  readyP = new Promise<void>((r) => (this.ready = r));
  next = 0;
  constructor() {
    (async () => {
      let rest = "";
      for await (const chunk of this.proc.stdout as unknown as AsyncIterable<Uint8Array>) {
        rest += new TextDecoder().decode(chunk);
        const lines = rest.split("\n");
        rest = lines.pop()!;
        for (const l of lines) {
          const m = JSON.parse(l);
          if (m.type === "ready") this.ready();
          else this.waiting.get(m.id)?.(m);
        }
      }
    })();
    this.send({ type: "init", kitUrl });
  }
  send(o: unknown) {
    this.proc.stdin.write(JSON.stringify(o) + "\n");
    this.proc.stdin.flush();
  }
  render(code: string, req: string): Promise<any> {
    const id = String(this.next++);
    return new Promise((r) => {
      this.waiting.set(id, r);
      this.send({ type: "render", id, pkgUrl: dataUrl(code + `\n// ${id}`), request: req });
    });
  }
}
const link = (code: string) => ok<string>(linkPackage(code, () => kitUrl));
const linked = link(pkg.code);
let t = performance.now();
let child = new Child();
await child.readyP;
console.log(`deno child cold start (spawn + kit import): ${(performance.now() - t).toFixed(1)} ms`);
t = performance.now();
let res = await child.render(linked, request);
console.log(`first render: ${(performance.now() - t).toFixed(1)} ms ${res.json ? "ok" : res.error}`);
const xs: number[] = [];
for (let i = 0; i < 40; i++) {
  const s = performance.now();
  res = await child.render(linked, request);
  xs.push(performance.now() - s);
}
console.log(
  `deno warm round trip agent-home (new package module each time, kit cached): median ${median(xs).toFixed(2)} ms, p95 ${[...xs].sort((a, b) => a - b)[37]!.toFixed(2)} ms`,
);

const header = `import * as __lf_sdk0 from "${kitUrl}";\n`;
const probe = (body: string) =>
  `${header}export default () => { ${body}\n return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" }); };`;
const probes: Record<string, string> = {
  "read file": `try { Deno.readTextFileSync("/etc/hostname"); throw new Error("READ ALLOWED"); } catch (e) { throw new Error("read: " + e.name + " " + e.message.slice(0, 60)); }`,
  fetch: `throw new Error("typeof fetch=" + typeof fetch + " typeof Deno=" + typeof Deno + " keys=" + Object.keys(Deno).length);`,
  "Deno.exit": `Deno.exit(7);`,
  env: `try { Deno.env.get("HOME"); throw new Error("ENV ALLOWED"); } catch (e) { throw new Error("env: " + e.name); }`,
  run: `try { new Deno.Command("id").outputSync(); throw new Error("RUN ALLOWED"); } catch (e) { throw new Error("run: " + e.name); }`,
  "infinite loop": `while (true) {}`,
  "memory bomb": `const a = []; while (true) a.push(new Array(1e6).fill(1));`,
  "indexOf hold": `'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b');`,
  "stdin write": `Deno.stdout.writeSync(new TextEncoder().encode(JSON.stringify({ type: "result", id: "0", json: "FORGED" }) + "\\n")); throw new Error("wrote to stdout");`,
};
for (const [name, body] of Object.entries(probes)) {
  child = new Child();
  await child.readyP;
  const s = performance.now();
  const p = child.render(probe(body), request);
  const v = await Promise.race([p, Bun.sleep(1500).then(() => ({ error: "NO ANSWER in 1.5 s (would be killed)" }))]);
  let text: string;
  try {
    text = JSON.stringify(v.json ? JSON.parse(v.json) : v).slice(0, 220);
  } catch {
    text = "host could not parse the reply: " + String(v.json).slice(0, 80);
  }
  console.log(`deno probe ${name.padEnd(14)} ${(performance.now() - s).toFixed(0).padStart(5)} ms  ${text}`);
  child.proc.kill("SIGKILL");
}
process.exit(0);
