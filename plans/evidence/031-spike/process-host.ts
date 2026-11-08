// Parent: cost of hosting QuickJS in a killable child process. Run from the repo root with --conditions liveframe:source.
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
const linked = ok<string>(linkPackage(pkg.code, () => "liveframe:kit"));
const request = JSON.stringify({
  inputs: proofWidgets[0]!.scenarios[0],
  options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "s", revision: 1 },
});
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

class Child {
  proc: ReturnType<typeof Bun.spawn>;
  waiting = new Map<number, (m: any) => void>();
  ready!: () => void;
  readyP = new Promise<void>((r) => (this.ready = r));
  next = 0;
  constructor() {
    this.proc = Bun.spawn([process.execPath, new URL("./child.ts", import.meta.url).pathname], {
      stdio: ["ignore", "inherit", "inherit"],
      serialization: "json",
      ipc: (m: any) => {
        if (m.type === "ready") this.ready();
        else if (m.type === "result") this.waiting.get(m.id)?.(m);
      },
    });
    this.proc.send({ type: "init", kit });
  }
  render(code: string, req: string, limits: object, freshWasm: boolean): Promise<any> {
    const id = this.next++;
    return new Promise((r) => {
      this.waiting.set(id, r);
      this.proc.send({ type: "render", id, code, request: req, limits, freshWasm });
    });
  }
}
const limits = { memoryBytes: 32 << 20, stackBytes: 256 << 10, timeoutMs: 1000 };
let t = performance.now();
let child = new Child();
await child.readyP;
console.log(`child cold start (spawn bun + wasm compile + kit received): ${(performance.now() - t).toFixed(1)} ms`);
t = performance.now();
let res = await child.render(linked, request, limits, false);
console.log(`first render in child: ${(performance.now() - t).toFixed(1)} ms ${res.json ? "ok" : res.error}`);
for (const fresh of [false, true]) {
  const xs: number[] = [];
  for (let i = 0; i < 40; i++) {
    const s = performance.now();
    res = await child.render(linked, request, limits, fresh);
    xs.push(performance.now() - s);
  }
  console.log(
    `round trip agent-home (fresh runtime${fresh ? " + fresh wasm instance" : ""}): median ${median(xs).toFixed(1)} ms, p95 ${[...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!.toFixed(1)} ms, result ${(res.json.length / 1024).toFixed(0)} KiB`,
  );
}
// hold + kill + recover
const hold = linked.replace('text: "ok"', 'text: "ok"') + "";
const header = `import * as __lf_sdk0 from "liveframe:kit";\n`;
const holdCode = `${header}export default () => { 'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b'); return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" }); };`;
void hold;
t = performance.now();
const held = child.render(holdCode, request, { ...limits, timeoutMs: 100 }, false);
const verdict = await Promise.race([
  held.then(() => "finished"),
  Bun.sleep(300).then(() => "deadline (300 ms): killing child"),
]);
console.log(verdict);
const k0 = performance.now();
child.proc.kill("SIGKILL");
await child.proc.exited;
console.log(`SIGKILL -> exited in ${(performance.now() - k0).toFixed(1)} ms`);
t = performance.now();
child = new Child();
await child.readyP;
res = await child.render(linked, request, limits, false);
console.log(`recovery: new child ready + next render ok=${!!res.json}: ${(performance.now() - t).toFixed(1)} ms`);
child.proc.kill();
process.exit(0);
