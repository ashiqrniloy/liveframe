// Run by `scripts/build.ts` after tsc: the agent digest (`liveframe gen --digest`, checked by `gen:check`) ships
// beside `dist/catalog.json`, which tsc does not copy because nothing imports it.
await Bun.write(
  new URL("./dist/catalog.digest.md", import.meta.url),
  Bun.file(new URL("./src/catalog.digest.md", import.meta.url)),
);
