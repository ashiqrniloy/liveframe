import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type * as Playwright from "playwright";
import {
  capture as captureBytes,
  CaptureError,
  playwrightBackend,
  type CaptureOptions as LibraryOptions,
  type CaptureIndex,
} from "../preview/capture/index.ts";
export { CaptureError } from "../preview/capture/index.ts";
export type CaptureOptions = Omit<LibraryOptions, "backend"> & { readonly out: string };
export class PlaywrightMissing extends CaptureError {
  override name = "PlaywrightMissing";
  constructor() {
    super("not-found", "Playwright is required: run `bun add -d playwright && bunx playwright install chromium`.");
  }
}
export async function defaultCaptureBackend(load: () => Promise<typeof Playwright> = () => import("playwright")) {
  const playwright = await load().catch(() => {
    throw new PlaywrightMissing();
  });
  return playwrightBackend(playwright);
}
export async function capture(
  url: string,
  options: CaptureOptions,
  load?: () => Promise<typeof Playwright>,
): Promise<CaptureIndex> {
  const result = await captureBytes(url, { ...options, backend: await defaultCaptureBackend(load) });
  await mkdir(options.out, { recursive: true });
  for (const [name, bytes] of result.files) await Bun.write(join(options.out, name), bytes);
  return result.index;
}
