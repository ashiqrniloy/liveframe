// Before/after parity: bun plans/evidence/016-task-3-alpha-parity.ts /path/to/pre-task-worktree
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { startHost } from "../../proof/host/server.ts";

const baselinePath = Bun.argv[2];
assert(Bun.argv.length === 3 && baselinePath, "Pass a checkout of the pre-task commit (71e1c8b)");
const baseline = resolve(baselinePath);
const projection = await import(`${baseline}/src/css/index.ts`);
const read = (name: string) => Bun.file(`${baseline}/src/__tests__/fixtures/proof/${name}.json`).json();
const catalog = await read("catalog");
assert(
  catalog.vocabulary.colourRoles.some((role: string) => role.includes(".alpha-")),
  "Baseline must contain the pre-migration alpha roles",
);
const checked = (result: { ok: boolean; value?: string; errors?: unknown }): string => {
  assert(result.ok, JSON.stringify(result.errors));
  assert(typeof result.value === "string");
  return result.value;
};
const sheets: Record<string, string> = { "/styles/base.css": checked(projection.baseCss(catalog)) };
for (const name of ["certified", "rack"]) {
  sheets[`/styles/${name}.theme.css`] = checked(projection.themeCss(await read(`${name}.theme`), catalog));
  sheets[`/styles/${name}.css`] = checked(
    projection.designSystemCss(await read(`${name}.design-system`), { catalog, registry: {} }),
  );
}
const out = "evidence/016-task-3-alpha-parity";
await mkdir(out, { recursive: true });
const host = await startHost(0);
const browser = await chromium.launch({ headless: true });
async function pixelDiff(page: Page, before: string, after: string) {
  return page.evaluate(
    async ({ before, after, threshold }) => {
      const load = async (png: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        return image;
      };
      const [a, b] = await Promise.all([load(before), load(after)]);
      const width = Math.max(a.width, b.width);
      const height = Math.max(a.height, b.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(a, 0, 0);
      const pixelsA = ctx.getImageData(0, 0, width, height).data;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(b, 0, 0);
      const pixelsB = ctx.getImageData(0, 0, width, height).data;
      const diff = ctx.createImageData(width, height);
      let changed = 0;
      let extent = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const inA = x < a.width && y < a.height;
          const inB = x < b.width && y < b.height;
          if (!inA && !inB) continue;
          extent++;
          const mismatch =
            inA !== inB ||
            [0, 1, 2, 3].some(
              (channel) => Math.abs((pixelsA[index + channel] ?? 0) - (pixelsB[index + channel] ?? 0)) > threshold,
            );
          if (mismatch) changed++;
          diff.data.set(mismatch ? [255, 0, 255, 255] : [235, 235, 235, 255], index);
        }
      ctx.putImageData(diff, 0, 0);
      return {
        width,
        height,
        approved: [a.width, a.height],
        widget: [b.width, b.height],
        changed,
        extent,
        ratio: changed / extent,
        png: canvas.toDataURL("image/png").split(",")[1] ?? "",
      };
    },
    { before, after, threshold: 16 },
  );
}

const results = [];
try {
  for (const width of [1440, 1024, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    try {
      for (const name of ["certified", "rack"]) {
        for (const widget of ["agent-home", "rack-module", "design-system"]) {
          const capture = async (before: boolean) => {
            if (before)
              await page.route("**/styles/*.css", (route) => {
                const sheet = sheets[new URL(route.request().url()).pathname];
                return sheet === undefined ? route.continue() : route.fulfill({ contentType: "text/css", body: sheet });
              });
            await page.goto(new URL(`/ui/${widget}`, host.url).href);
            await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
            await page.selectOption("#design-system", name);
            await page.evaluate(() => document.fonts.ready);
            await page.mouse.move(0, 0);
            const png = await page.locator("#app").screenshot({
              animations: "disabled",
              path: `${out}/${name}-${widget}-${width}-${before ? "before" : "after"}.png`,
            });
            if (before) await page.unroute("**/styles/*.css");
            return png.toString("base64");
          };
          const before = await capture(true);
          const after = await capture(false);
          const { png, ...pixels } = await pixelDiff(page, before, after);
          await Bun.write(`${out}/${name}-${widget}-${width}-diff.png`, Buffer.from(png, "base64"));
          results.push({ name, widget, width, ...pixels });
          console.log(`${name} ${widget} ${width}: ${(pixels.ratio * 100).toFixed(4)}% changed`);
          assert(pixels.ratio <= 0.01, "Alpha migration exceeds 1% pixel difference");
        }
      }
    } finally {
      await page.close();
    }
  }
  await Bun.write(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await host.stop(true);
}
