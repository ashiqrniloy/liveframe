// Design-system motion through `/dom` (plan 038 Task 6, design §2.5): the cases `/react` passes, on a DOM page.
import { motionBrowserTests } from "./fixtures/motion-browser.ts";

motionBrowserTests(new URL("./fixtures/dom-motion-client.ts", import.meta.url).pathname, "dom_");
