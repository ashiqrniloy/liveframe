import { type Browser, chromium, firefox, type LaunchOptions, webkit } from "playwright";

const engines = { chromium, firefox, webkit } as const;
export type BrowserName = keyof typeof engines;

const requested = process.env.LIVEFRAME_BROWSER ?? "chromium";
if (!Object.hasOwn(engines, requested))
  throw new Error(`LIVEFRAME_BROWSER must be chromium, firefox or webkit; got ${requested}`);
export const browserName = requested as BrowserName;

/** One engine parameter for every browser test; select it with LIVEFRAME_BROWSER. */
export function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  return engines[browserName].launch({ headless: true, ...options });
}
