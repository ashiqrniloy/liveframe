import { mkdir } from "node:fs/promises";
import { formats, schemaDocument } from "../src/formats/registry.ts";

const check = Bun.argv.includes("--check");
const directory = new URL("../schemas/", import.meta.url);
if (!check) await mkdir(directory, { recursive: true });

for (const name of Object.keys(formats) as (keyof typeof formats)[]) {
  const path = new URL(`${name}.json`, directory);
  const content = `${JSON.stringify(schemaDocument(name), null, 2)}\n`;
  if (check) {
    const file = Bun.file(path);
    if (!(await file.exists()) || (await file.text()) !== content) {
      console.error(`Schema drift: schemas/${name}.json (regenerate with bun scripts/schemas.ts)`);
      process.exitCode = 1;
    }
  } else await Bun.write(path, content);
}

if (check) {
  for await (const name of new Bun.Glob("*.json").scan(directory.pathname)) {
    if (!Object.hasOwn(formats, name.slice(0, -5))) {
      console.error(`Unregistered schema: schemas/${name}`);
      process.exitCode = 1;
    }
  }
}
