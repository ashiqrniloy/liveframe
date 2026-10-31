import config from "./mcp.config.ts";
import { fakeCapture } from "./capture-backend.ts";
const axes = process.env.LF_CAPTURE_WIDTHS
  ? {
      scenarios: ["ready"],
      widths: Array.from({ length: Number(process.env.LF_CAPTURE_WIDTHS) }, (_, i) => 360 + i),
      themes: ["light"],
      designSystems: ["plain"],
    }
  : undefined;
const fake = fakeCapture(axes, process.env.LF_NULL_SNAPSHOT ? null : '- text "Hello"', (width) => ({
  width,
  height: 100,
  overflowX: false,
  overflowing: [],
  nodes: Array.from({ length: process.env.LF_HUGE_LAYOUT ? 6000 : 1 }, (_, i) => ({
    id: `node-${i}`,
    x: 0,
    y: i,
    width,
    height: 1,
  })),
}));
if (process.env.LF_CAPTURE_FAILURE)
  fake.backend.open = async () => {
    throw new Error("backend failed");
  };
export default {
  ...config,
  ...(process.env.LF_MAX_CAPTURE_CELLS === undefined
    ? {}
    : { maxCaptureCells: JSON.parse(process.env.LF_MAX_CAPTURE_CELLS) }),
  capture: fake.backend,
  preview: async () => ({ url: "https://example.test/preview", async close() {} }),
};
