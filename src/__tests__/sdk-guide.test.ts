import { expect, test } from "bun:test";
import { applyPatch, diffTrees, type UiTree } from "@arnilo/liveframe";
import { render, renderElements, streamElements } from "@arnilo/liveframe/sdk";
import { Claim, inputs, result, validator } from "./fixtures/sdk-guide.tsx";
import { chunksOf, streamLoopDocument, streamLoopValidator } from "./fixtures/stream-loop.ts";

test("sdk_guide_example_matches_documentation_and_renders", async () => {
  const source = await Bun.file(new URL("./fixtures/sdk-guide.tsx", import.meta.url)).text();
  const example = source
    .replaceAll("./proof/agent-home.manifest.json", "./manifest.json")
    .replaceAll("./proof/capabilities.json", "./capabilities.json")
    .replaceAll("./proof/catalog.json", "./catalog.json")
    .replaceAll("./widgets/ui.gen.ts", "./ui.gen.ts");
  const guide = await Bun.file(new URL("../../docs/sdk.md", import.meta.url)).text();
  expect(guide).toContain(`\`\`\`tsx\n${example}\`\`\``);
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

// Plan 042 Task 4 (LF-36): the streaming loop in "Draw agent JSON while it streams", run as written.
const FRAME_MS = 16;
const PUSHES_PER_FRAME = 50;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>;

async function streamLoop() {
  const guide = await Bun.file(new URL("../../docs/sdk.md", import.meta.url)).text();
  const section = guide.slice(guide.indexOf("## Draw agent JSON while it streams"));
  const block = section.match(/```ts\n([\s\S]*?)```/)?.[1];
  if (!block?.includes("FRAME_MS")) throw new Error("Streaming loop block missing from docs/sdk.md");
  const body = block.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "");
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(body);
  return new AsyncFunction("validator", "llm", "send", "now", "diffTrees", "streamElements", js);
}

type Sent = { readonly at: number; readonly message: { tree?: UiTree; patch?: unknown } };

/** Runs the guide's loop over `chunks`; the clock moves one frame every `PUSHES_PER_FRAME` chunks. */
async function runLoop(chunks: readonly string[]) {
  const loop = await streamLoop();
  let pulled = 0;
  const sent: Sent[] = [];
  async function* llm() {
    for (const chunk of chunks) {
      pulled++;
      yield chunk;
    }
  }
  const now = () => Math.floor(pulled / PUSHES_PER_FRAME) * FRAME_MS;
  const send = (message: Sent["message"]) => sent.push({ at: pulled, message });
  await loop(streamLoopValidator, llm(), send, now, diffTrees, streamElements);
  return { sent, frames: Math.floor(pulled / PUSHES_PER_FRAME) };
}

const loopText = JSON.stringify(streamLoopDocument(1_000));
const loopChunks = chunksOf(loopText, 4);

test("stream_guide_loop_sends_at_most_one_update_per_frame", async () => {
  const { sent, frames } = await runLoop(loopChunks);
  let trees = 0;
  const stream = streamElements({ validator: streamLoopValidator, surfaceId: "chat-42" });
  for (const chunk of loopChunks) if (stream.push(chunk)?.ok) trees++;
  expect(trees).toBeGreaterThan(1_000);
  expect(sent.length).toBeGreaterThan(2);
  expect(sent.length).toBeLessThanOrEqual(frames + 2);
  expect(sent.length).toBeLessThan(trees / 3);
});

test("stream_guide_loop_reaches_the_tree_render_elements_gives", async () => {
  const { sent } = await runLoop(loopChunks);
  let client: UiTree | undefined;
  for (const { message } of sent) {
    if (message.tree) client = message.tree;
    else {
      if (!client) throw new Error("A patch arrived before a tree");
      const applied = applyPatch(client, message.patch);
      if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
      client = applied.value;
    }
    expect(streamLoopValidator.validateTree(client).ok).toBe(true);
  }
  const patches = sent.filter(({ message }) => message.patch).length;
  expect(patches).toBeGreaterThan(0);
  const whole = renderElements(JSON.parse(loopText), {
    validator: streamLoopValidator,
    surfaceId: "chat-42",
    revision: 0,
  });
  if (!whole.ok || !client) throw new Error("The document must render");
  expect(client.root).toEqual(whole.value.root);
  expect(sent.at(-1)?.message.tree?.root).toEqual(whole.value.root);
});

test("stream_guide_loop_sends_nothing_after_a_failure", async () => {
  const cut = loopText.indexOf('"key":"r600"');
  const broken = chunksOf(`${loopText.slice(0, cut)}]]${loopText.slice(cut)}`, 4);
  const stream = streamElements({ validator: streamLoopValidator, surfaceId: "chat-42" });
  const failedAt = broken.findIndex((chunk) => stream.push(chunk)?.ok === false) + 1;
  expect(failedAt).toBeGreaterThan(0);
  const { sent } = await runLoop(broken);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.every(({ at }) => at < failedAt)).toBe(true);
});
