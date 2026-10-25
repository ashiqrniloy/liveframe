/** Gate step 5: an adopter's browser bundle builds from the installed package alone. */

// The same string the fixture widget declares; the scan must find it in the draft and not the bundle.
const marker = "DraftOnlyMarkerGate2f";

const build = await Bun.build({
  entrypoints: [new URL("./page.ts", import.meta.url).pathname],
  target: "browser",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
const [output] = build.outputs;
if (!output) throw new Error("The bundle has no output");
if (!(await Bun.file(new URL("./widget/card.tsx", import.meta.url)).text()).includes(marker))
  throw new Error("The fixture widget lost its marker");

const text = await output.text();
if (text.includes(marker)) throw new Error("The bundle contains draft code");
const inputs = Object.keys(build.metafile?.inputs ?? {});
for (const subpath of ["react", "preview/react", "css", "conformance/react"])
  if (!inputs.some((path) => path.includes(`node_modules/@arnilo/liveframe/dist/${subpath}/`)))
    throw new Error(`The bundle never reached /${subpath}`);
if (inputs.some((path) => path.includes("/src/")))
  throw new Error(`The bundle reached outside the installed package: ${inputs.join(", ")}`);
console.log(`bundled ${(text.length / 1024).toFixed(0)} KB from ${inputs.length} installed modules`);
