import { proofCatalog, type RenderOptions } from "../../runtime/index.ts";

export interface GitEntry {
  workspaceRootId: string;
  workspaceRoot: string;
  snapshot: {
    head: { kind: string; name?: string; shortSha?: string } | null;
    dirty: boolean;
    changedFileCount?: number;
  } | null;
  refreshState: { kind: string; status?: { kind: string } } | null;
}
export interface RackData {
  containerId: string;
  sessionId: string;
  files: { name: string; status: string; operation: string }[];
}
const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const context = {
  type: "object",
  properties: { size: { type: "string", enum: ["small", "medium", "large", "full"] } },
  required: ["size"],
  additionalProperties: false,
} as const;
export const gitOptions: RenderOptions = { catalog: proofCatalog, params: empty, state: empty, context, actions: [] };
export const initialRackState = { tab: "files", draft: "check the context tab" };
export const rackActions = {
  "container.close": {
    type: "object",
    properties: { containerId: { type: "string", maxLength: 128 } },
    required: ["containerId"],
    additionalProperties: false,
  },
  "agent.send": {
    type: "object",
    properties: {
      sessionId: { type: "string", maxLength: 128 },
      message: { type: "string", minLength: 1, maxLength: 10000 },
    },
    required: ["sessionId", "message"],
    additionalProperties: false,
  },
} as const;
export const rackOptions: RenderOptions = {
  catalog: proofCatalog,
  params: empty,
  context,
  actions: Object.keys(rackActions),
  state: {
    type: "object",
    properties: {
      tab: { type: "string", enum: ["files", "om", "context"] },
      draft: { type: "string", maxLength: 10000 },
    },
    required: ["tab", "draft"],
    additionalProperties: false,
  },
};
