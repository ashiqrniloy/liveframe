import { expect, test } from "bun:test";
import { render } from "@arnilo/liveframe/sdk";
import { Claim, inputs, result, validator } from "./fixtures/sdk-guide.tsx";

test("sdk_guide_example_matches_documentation_and_renders", async () => {
  const source = await Bun.file(new URL("./fixtures/sdk-guide.tsx", import.meta.url)).text();
  const example = source
    .replaceAll("./proof/agent-home.manifest.json", "./manifest.json")
    .replaceAll("./proof/capabilities.json", "./capabilities.json")
    .replaceAll("./proof/catalog.json", "./catalog.json")
    .replaceAll("./widgets/ui.gen.ts", "./ui.gen.ts");
  const guide = await Bun.file(new URL("../../docs/sdk.md", import.meta.url)).text();
  expect(guide).toContain("```tsx\n" + example + "```");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("guide example failed");
  expect(validator.validateTree(result.value).ok).toBe(true);
  expect(result.value.root.children?.map((node) => node.id)).toEqual(["root/text", "root/select", "root/claim"]);
  expect(result.value.root.children?.[1]?.events?.onPress).toEqual({ type: "setState", key: "selected", value: "t1" });
  expect(result.value.root.children?.[2]?.events?.onPress).toEqual({
    type: "action",
    name: "tasks.claim",
    args: { id: "t1" },
  });
  const repeated = render(Claim, inputs, { validator, surfaceId: "home", revision: 1 });
  expect(repeated).toEqual(result);
});
