import config from "./mcp.config.ts";

export default { ...config, limits: JSON.parse(process.env.LF_TEST_LIMITS ?? "{}") };
