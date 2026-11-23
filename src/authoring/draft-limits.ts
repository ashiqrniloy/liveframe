export const MAX_DRAFT_BYTES = 1048576;

/** Set only by the CLI reader after checking the directory's file and byte bounds. */
export const boundedDirectoryDraft = Symbol("boundedDirectoryDraft");
