import { afterAll, describe, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalogSuite, designSystemSuite, storeSuite } from "@arnilo/liveframe/conformance";
import { rendererSuite } from "@arnilo/liveframe/conformance/react";
import type { Store } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import { capabilities, catalog, designSystems, themes } from "../app.ts";
import { examples, manifest, pageOptions } from "../conformance-host.ts";
import { primitiveCss } from "../primitives/css.ts";

// Each create() opens a fresh directory; reopen() opens the same one through a new store.
const scopes = new Map<Store, string>();
const made: string[] = [];
afterAll(() => Promise.all(made.map((dir) => rm(dir, { recursive: true, force: true }))));

function register(name: string, cases: { name: string; run(): Promise<void>; timeout?: number | undefined }[]) {
  describe(name, () => {
    for (const c of cases) test(c.name, c.run, c.timeout);
  });
}

register(
  "store",
  storeSuite({
    async create() {
      const dir = await mkdtemp(join(tmpdir(), "liveframe-demo-store-"));
      made.push(dir);
      const store = fileStore(dir);
      scopes.set(store, dir);
      return store;
    },
    reopen(store) {
      const dir = scopes.get(store);
      if (!dir) throw new Error("Unknown store scope");
      return fileStore(dir);
    },
  }),
);
register("catalog", catalogSuite({ catalog, capabilities, manifest, examples, published: catalog }));
register("design system", designSystemSuite({ catalog, themes, designSystems, sheets: [primitiveCss] }));
register("renderer", rendererSuite({ ...pageOptions, examples }));
