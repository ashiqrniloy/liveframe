import { test } from "bun:test";
import { storeSuite } from "@arnilo/liveframe/conformance";
import { memoryStore } from "@arnilo/liveframe/store";

for (const c of storeSuite({ create: memoryStore })) test(c.name, c.run, c.timeout);
