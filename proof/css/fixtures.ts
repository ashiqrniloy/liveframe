import { validateCatalog } from "@arnilo/liveframe";
import document from "../../src/__tests__/fixtures/proof/catalog.json";

const checked = validateCatalog(document);
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
export const catalog = checked.value;
