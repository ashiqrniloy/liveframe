import { chromium } from "playwright";

// Decision sketch only: these declarations model the proposed projection, not shipped support.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>
    section { --lf-c-surface: oklch(60% 0.1 200 / 0.8); }
    [role=button] { background: transparent; border: 0; outline: none; }
    #alpha { background: color-mix(in oklab, var(--lf-c-surface) 25%, transparent); }
    @media (forced-colors: active) {
      #explicit-none { outline: 1px solid CanvasText; outline-offset: -1px; }
    }
  </style><section><div role="button" id="absent">Absent background</div>
    <div role="button" id="explicit-none">Explicit none</div><div role="button" id="alpha">Alpha</div></section>`);
  const alpha = await page.locator("#alpha").evaluate((el) => getComputedStyle(el).backgroundColor);
  if (!alpha.endsWith("/ 0.2)")) throw new Error(`Expected theme alpha 0.8 × modifier 0.25: ${alpha}`);
  await page.emulateMedia({ forcedColors: "active" });
  const outlines = await page.locator("[role=button]").evaluateAll((elements) =>
    elements.slice(0, 2).map((el) => {
      const style = getComputedStyle(el);
      return {
        width: style.outlineWidth,
        line: style.outlineStyle,
        offset: style.outlineOffset,
        adjust: style.forcedColorAdjust,
      };
    }),
  );
  if (outlines[0]?.line !== "none" || outlines[1]?.width !== "1px" || outlines[1]?.offset !== "-1px")
    throw new Error(`Unexpected edge treatment: ${JSON.stringify(outlines)}`);
  if (outlines.some((style) => style.adjust !== "auto")) throw new Error("OS colour authority disabled");
  console.log(JSON.stringify({ browser: browser.version(), alpha, outlines }, null, 2));
} finally {
  await browser.close();
}
