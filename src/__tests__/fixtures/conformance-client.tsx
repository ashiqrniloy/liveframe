import { conformancePage } from "../../conformance/react/index.ts";
import { implementations, pageOptions } from "./conformance-browser.tsx";

const mode = new URL(location.href).searchParams.get("mutant") ?? "";
conformancePage({ ...pageOptions, implementations: implementations(mode) });
