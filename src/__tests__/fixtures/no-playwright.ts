import { mock } from "bun:test";

// Makes every Playwright import fail, as on an install without the optional peer.
// A preload `plugin()` cannot see dynamic imports of bare specifiers (Bun 1.4.4); `mock.module` can.
for (const specifier of ["playwright", "playwright-core"])
  mock.module(specifier, () => {
    throw new Error(`${specifier} is not installed`);
  });
