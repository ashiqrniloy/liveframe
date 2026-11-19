// Design-system motion through `<Surface>` (plan 038 Task 3, design M.11–M.16), in the engine LIVEFRAME_BROWSER names.
import { motionBrowserTests } from "./fixtures/motion-browser.ts";

motionBrowserTests(new URL("./fixtures/react-motion-client.tsx", import.meta.url).pathname);
