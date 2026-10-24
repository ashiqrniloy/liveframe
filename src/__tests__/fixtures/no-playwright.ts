import { plugin } from "bun";

// Makes every `playwright` import fail, as on an install without the optional peer.
plugin({
  name: "no-playwright",
  setup(build) {
    build.onResolve({ filter: /^playwright(-core)?$/ }, () => {
      throw new Error("playwright is not installed");
    });
  },
});
