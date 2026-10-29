import config from "./mcp.config.ts";
import { fakeCapture } from "./capture-backend.ts";
const fake = fakeCapture(undefined, process.env.LF_NULL_SNAPSHOT ? null : '- text "Hello"');
if (process.env.LF_CAPTURE_FAILURE)
  fake.backend.open = async () => {
    throw new Error("backend failed");
  };
export default {
  ...config,
  capture: fake.backend,
  preview: async () => ({ url: "https://example.test/preview", async close() {} }),
};
