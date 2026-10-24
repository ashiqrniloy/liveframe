import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium, type Page } from "playwright";
import { startHost } from "../host/server.ts";

const args = Bun.argv.slice(2);
assert(
  args.length === 0 || (args.length === 2 && args[0] === "--out"),
  "Usage: bun proof/scripts/parity.ts [--out evidence/parity]",
);
const out = resolve(args[1] ?? "evidence/parity");
assert(out.startsWith(`${resolve("evidence")}${sep}`), "Output must be below evidence/");
await mkdir(out, { recursive: true });

const artifactPath = "proof/references/synapta-core/design-artifacts/approved/agent-home-certified.html";
const artifact = await Bun.file(artifactPath).text();
const fontRoot = resolve("proof/references/synapta-core/design-artifacts/fonts");
const snapshotFont = (pathname: string) => {
  const file = resolve(fontRoot, `.${pathname.slice("/fonts".length)}`);
  return file.startsWith(`${fontRoot}${sep}`) ? Bun.file(file) : null;
};
const host = await startHost(0);
const reference = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/artifact")
      return new Response(artifact, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    const font = pathname.startsWith("/fonts/") ? snapshotFont(pathname) : null;
    return font
      ? new Response(font, { headers: { "Content-Type": "font/woff2" } })
      : new Response("Not in the pinned snapshot", { status: 404 });
  },
});
const browser = await chromium.launch({ headless: true, timeout: 30000 });
const properties = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "display",
  "position",
  "grid-template-columns",
  "row-gap",
  "column-gap",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
] as const;
const thresholds = { pixelChannel: 16, pixelRatio: 0.01, cssPx: 0.5, dom: "exact" };
const different = (before: string, after: string) => {
  if (before === after) return false;
  if (/^-?[\d.]+px$/.test(before) && /^-?[\d.]+px$/.test(after)) {
    return Math.abs(Number.parseFloat(before) - Number.parseFloat(after)) > thresholds.cssPx;
  }
  return true;
};
assert(!different("10px", "10.5px") && different("10px", "10.51px") && different("grid", "flex"));

async function capture(page: Page, approved: boolean, width: number, align?: { x: number; y: number }) {
  const selector = approved ? '[data-widget="core.queue"]' : "#app > :first-child > :first-child";
  const region = page.locator(selector);
  assert.equal(await region.count(), 1, `Expected one queue: ${selector}`);
  // Sub-pixel glyph rasterisation depends on the page offset: a region drawn at another fraction of a
  // pixel differs in antialiasing alone. Draw the widget at the artifact's own offset before capturing.
  const origin = await region.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY };
  });
  if (align) {
    await page.evaluate(
      ({ dx, dy }) => {
        document.body.style.paddingLeft = `${dx}px`;
        document.body.style.paddingTop = `${dy}px`;
      },
      { dx: align.x - origin.x, dy: align.y - origin.y },
    );
  }
  await page.evaluate(async () => {
    // Load both faces explicitly: a page that draws no mono text would otherwise leave Martian Mono unloaded.
    await Promise.all([document.fonts.load('16px "Schibsted Grotesk"'), document.fonts.load('16px "Martian Mono"')]);
    await document.fonts.ready;
  });
  const fonts = await page.evaluate(() => ({
    loaded: [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family),
    schibsted: document.fonts.check('16px "Schibsted Grotesk"'),
    martian: document.fonts.check('16px "Martian Mono"'),
  }));
  assert(
    fonts.schibsted &&
      fonts.martian &&
      ["Schibsted Grotesk", "Martian Mono"].every((face) => fonts.loaded.includes(face)),
    `Fonts not loaded: ${JSON.stringify(fonts)}`,
  );
  const placed = await region.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY };
  });
  await page.screenshot({
    path: `${out}/${width}-${approved ? "approved" : "widget"}-page.png`,
    fullPage: true,
    animations: "disabled",
  });
  await region.scrollIntoViewIfNeeded();
  const png = await region.screenshot({
    path: `${out}/${width}-${approved ? "approved" : "widget"}-queue.png`,
    animations: "disabled",
    // Exclude host overlays from the region image; the full-page image retains them.
    style: approved ? ".reviewbar, #agent-dock { opacity: 0 !important; }" : "",
  });
  const snapshot = await region.evaluate(
    (root, { approved, properties }) => {
      const text = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();
      const elements = [root, ...root.querySelectorAll("*")];
      const exact = (value: string) =>
        elements.find(
          (element) => text(element) === value && ![...element.children].some((child) => text(child) === value),
        );
      const heading = elements.find(
        (element) => /^H[1-6]$/.test(element.tagName) && text(element).startsWith("Apply the vendor"),
      );
      const firstRow = elements.find(
        (element) => element.tagName === "BUTTON" && text(element).startsWith("Apply the vendor"),
      );
      const card = approved ? root.querySelector("article") : heading?.closest("article");
      const anchors: Record<string, Element | null | undefined> = {
        queue: root,
        header: root.querySelector("header"),
        title: exact("Queue"),
        checked: exact("Checked 2026-09-28 14:02 UTC"),
        tabs: root.querySelector('[role="tablist"]'),
        tab: root.querySelector('[role="tab"]'),
        grid: approved ? root.querySelector(".grid-2--queue") : card?.parentElement?.parentElement,
        focus: approved ? root.querySelector(".focus") : card?.parentElement,
        card,
        cardTitle: heading,
        kicker: exact("Decision · Synapta prepared this for you"),
        review: exact("Review and decide")?.closest("a,button"),
        rows: root.querySelector("aside"),
        row: firstRow,
        rowTitle: approved ? firstRow?.querySelector(".line__title") : firstRow?.querySelector("span"),
        category: exact("Decisions"),
        pager: approved ? root.querySelector(".cursor-nav") : root.querySelector("nav"),
        next: exact("Next")?.closest("button"),
      };
      const styles = Object.fromEntries(
        Object.entries(anchors).map(([name, element]) => {
          if (!element) throw new Error(`Missing style anchor: ${name}`);
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return [
            name,
            {
              tag: element.tagName.toLowerCase(),
              width: rect.width,
              height: rect.height,
              values: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
            },
          ];
        }),
      );
      const dom: Record<string, unknown> = {};
      const walk = (element: Element, path: string) => {
        const attributes = Object.fromEntries(
          [...element.attributes]
            .filter(
              ({ name }) =>
                name === "role" ||
                (name.startsWith("aria-") && !["aria-controls", "aria-labelledby", "aria-describedby"].includes(name)),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ name, value }) => [name, value]),
        );
        dom[path] = {
          tag: element.tagName.toLowerCase(),
          attributes,
          text: [...element.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        };
        [...element.children].forEach((child, index) => {
          walk(child, `${path}/${index}`);
        });
      };
      walk(root, "queue");
      return {
        dom,
        styles,
        text: text(root),
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
      };
    },
    { approved, properties: [...properties] },
  );
  return { png: png.toString("base64"), snapshot: { ...snapshot, fonts, origin: placed } };
}

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
    { before, after, threshold: thresholds.pixelChannel },
  );
}

const results = [];
const domInventory = new Map<string, number[]>();
const styleInventory = new Map<string, number[]>();
const cell = (value: unknown) => JSON.stringify(value).replaceAll("|", "\\|");
try {
  for (const width of [1440, 1024, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
    });
    const diagnostics: string[] = [];
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    const approvedPage = await context.newPage();
    const widgetPage = await context.newPage();
    for (const page of [approvedPage, widgetPage]) {
      page.setDefaultTimeout(10000);
      page.on("pageerror", (error) => {
        diagnostics.push(`pageerror: ${error.message}`);
      });
      page.on("response", (response) => {
        if (!response.ok()) diagnostics.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
    }
    try {
      await approvedPage.goto(new URL("/artifact", reference.url).href);
      await widgetPage.goto(new URL("/ui/agent-home", host.url).href);
      await widgetPage.waitForFunction(() => document.documentElement.dataset.ready === "true");
      if (width === 1440) {
        const samples = await widgetPage.evaluate(() => {
          const image = (width: number, color: string) => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = 1;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas unavailable");
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, 1);
            return canvas.toDataURL("image/png").split(",")[1] ?? "";
          };
          return { white: image(1, "white"), black: image(1, "black"), wider: image(2, "white") };
        });
        assert.equal((await pixelDiff(widgetPage, samples.white, samples.black)).changed, 1);
        const extent = await pixelDiff(widgetPage, samples.white, samples.wider);
        assert.equal(extent.changed, 1);
        assert.equal(extent.ratio, 0.5);
      }
      const approved = await capture(approvedPage, true, width);
      const widget = await capture(widgetPage, false, width, {
        x: approved.snapshot.origin.x,
        y: approved.snapshot.origin.y,
      });
      assert(
        Math.abs(widget.snapshot.origin.x - approved.snapshot.origin.x) < 0.01 &&
          Math.abs(widget.snapshot.origin.y - approved.snapshot.origin.y) < 0.01,
        `Widget region is not aligned: ${JSON.stringify([approved.snapshot.origin, widget.snapshot.origin])}`,
      );
      assert.equal(approved.snapshot.viewport.width, width);
      assert.equal(widget.snapshot.viewport.width, width);
      const identical = await pixelDiff(widgetPage, widget.png, widget.png);
      assert.equal(identical.changed, 0, "Identical-image diff self-check");
      const pixels = await pixelDiff(widgetPage, approved.png, widget.png);
      await Bun.write(`${out}/${width}-pixel-diff.png`, Buffer.from(pixels.png, "base64"));
      const dom = [...new Set([...Object.keys(approved.snapshot.dom), ...Object.keys(widget.snapshot.dom)])]
        .filter((path) => JSON.stringify(approved.snapshot.dom[path]) !== JSON.stringify(widget.snapshot.dom[path]))
        .map((path) => ({
          path,
          approved: approved.snapshot.dom[path] ?? null,
          widget: widget.snapshot.dom[path] ?? null,
          disposition: "gap",
        }));
      const styles = Object.entries(approved.snapshot.styles).flatMap(([anchor, before]) => {
        const after = widget.snapshot.styles[anchor];
        assert(after);
        return properties
          .filter((property) => different(before.values[property] ?? "", after.values[property] ?? ""))
          .map((property) => ({
            anchor,
            property,
            approved: before.values[property],
            widget: after.values[property],
            disposition: "gap",
          }));
      });
      assert.equal(diagnostics.length, 0, diagnostics.join("\n"));
      const { png: _, ...pixelSummary } = pixels;
      const result = {
        width,
        pixels: pixelSummary,
        domDifferences: dom.length,
        styleDifferences: styles.length,
        diagnostics,
        parity: pixels.ratio <= thresholds.pixelRatio && dom.length === 0 && styles.length === 0,
      };
      await Bun.write(
        `${out}/${width}-dom.json`,
        JSON.stringify({ approved: approved.snapshot.dom, widget: widget.snapshot.dom, differences: dom }, null, 2),
      );
      await Bun.write(
        `${out}/${width}-styles.json`,
        JSON.stringify({ approved: approved.snapshot, widget: widget.snapshot, differences: styles }, null, 2),
      );
      for (const [entries, inventory] of [
        [dom, domInventory],
        [styles, styleInventory],
      ] as const) {
        for (const entry of entries) {
          const key = JSON.stringify(entry);
          inventory.set(key, [...(inventory.get(key) ?? []), width]);
        }
      }
      results.push(result);
      console.log(JSON.stringify(result));
    } finally {
      await context.close();
    }
  }
  await Bun.write(
    `${out}/summary.json`,
    JSON.stringify(
      {
        artifactPath,
        artifactSha256: Bun.CryptoHasher.hash("sha256", artifact, "hex"),
        playwright: (await import("playwright/package.json")).version,
        chromium: browser.version(),
        bun: Bun.version,
        thresholds,
        results,
      },
      null,
      2,
    ),
  );
  const domRows = [...domInventory].map(([json, widths]) => {
    const entry = JSON.parse(json);
    return `| ${widths.join(", ")} | ${entry.path} | ${cell(entry.approved)} | ${cell(entry.widget)} |`;
  });
  const styleRows = [...styleInventory].map(([json, widths]) => {
    const entry = JSON.parse(json);
    return `| ${widths.join(", ")} | ${entry.anchor} | ${entry.property} | ${cell(entry.approved)} | ${cell(entry.widget)} |`;
  });
  await Bun.write(
    `${out}/differences.md`,
    `Every row below is a **gap**. Equal findings across widths share one row. DOM paths use element-child indexes; changed wrappers shift descendants. IDs/classes/style serialization and generated ARIA ID references are omitted; semantic tags, direct text and other ARIA attributes are compared exactly.\n\n| Widths (px) | DOM path | Approved | Widget |\n| --- | --- | --- | --- |\n${domRows.join("\n")}\n\n| Widths (px) | Style anchor | Property | Approved | Widget |\n| --- | --- | --- | --- | --- |\n${styleRows.join("\n")}\n`,
  );
} finally {
  await browser.close();
  await host.stop(true);
  await reference.stop(true);
}
