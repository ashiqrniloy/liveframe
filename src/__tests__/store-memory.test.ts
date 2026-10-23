import { memoryStore } from "@arnilo/liveframe/store";
import { storeContract } from "./store-contract.ts";

storeContract("memory", memoryStore);
