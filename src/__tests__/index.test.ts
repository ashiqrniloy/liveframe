import { expect, test } from "bun:test";
import { LIVEFRAME_FORMAT } from "../index.ts";

test("the wire format id matches spec §9", () => {
  expect(LIVEFRAME_FORMAT).toBe("liveframe/1");
});
