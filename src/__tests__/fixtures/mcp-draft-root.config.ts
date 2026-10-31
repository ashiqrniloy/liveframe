import config from "./mcp.config.ts";

export default {
  ...config,
  draftRoot: process.env.LIVEFRAME_TEST_DRAFT_ROOT,
};
