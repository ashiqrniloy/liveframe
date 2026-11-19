// Conformance for the plain DOM adapter: the renderer cases `/conformance/react` runs, mounted through `/dom`.
export type { BrowserFixtures } from "../renderer/browser.ts";
export type { Styles } from "../renderer/page.ts";
export { type DomPageOptions, domConformancePage } from "./page.ts";
export { type DomSuiteOptions, domRendererBrowserSuite } from "./suite.ts";
