import { drafts, packageOptions } from "./widgets/drafts.ts";

// The values a host supplies to the guide's example.
export const { catalog, capabilities } = packageOptions;
export const draft = drafts[0] as NonNullable<(typeof drafts)[0]>;
