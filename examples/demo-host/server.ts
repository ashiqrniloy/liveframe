import {
  checkOffered,
  compileValidator,
  type CompiledValidator,
  type Intent,
  type IntentOrigin,
  checkValue,
  type Json,
  LiveframeFailure,
  type Manifest,
  type UiTree,
} from "@arnilo/liveframe";
import { pack, verifyPackage } from "@arnilo/liveframe/pack";
import { createPreview } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { loadPlacement, validatePlacement } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import { capabilities, catalog } from "./app.ts";
import { previewRoutes } from "./preview.ts";
import { readDraft } from "./widgets/draft.ts";

const page = await Bun.file(new URL("./page.html", import.meta.url)).text();
// The browser gets this bundle and the validated tree. Widget code never reaches it (law 1).
const clientBundle = Bun.build({
  entrypoints: [new URL("./client.tsx", import.meta.url).pathname],
  target: "browser",
}).then((build) => {
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Client build failed");
  return bundle;
});
// The first render also starts the worker, so the demo allows more than the 100 ms default.
const timeoutMs = 5000;
const documents = { catalog, capabilities };
const dataDirectory = new URL("./.data/", import.meta.url).pathname;

type Request<P extends string> = Bun.BunRequest<P>;
type ActionRecord = { readonly placement: string; readonly name: string; readonly args: Json };

/** The operations this host offers behind `capabilities.json`. A widget only asks for them by name. */
const operations: Record<string, (args: Record<string, Json>) => void> = {
  "demo.notify": ({ message }) => console.log(`demo.notify: ${String(message)}`),
};

const error = (message: string, status: number) => Response.json({ error: message }, { status });
const isRecord = (value: unknown): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function startHost({ dataDir = dataDirectory, port = 3300 }: { dataDir?: string; port?: number } = {}) {
  const bundle = await clientBundle;
  const store = fileStore(dataDir);
  const runner = workerRunner();
  // The preview page uses the production runner, so what an author sees is what a viewer gets.
  const session = createPreview({ ...documents, runner });
  const drafted = session.update(await readDraft(new URL("./widgets/hello/", import.meta.url).pathname));
  if (!drafted.ok) throw new AggregateError(drafted.errors, "The preview draft does not pack");
  const draftPackage = drafted.value;
  const actions: ActionRecord[] = [];
  const revisions = new Map<string, number>();
  const served = new Map<string, { tree: UiTree; manifest: Manifest; state: Json; validator: CompiledValidator }>();
  // Records live in one directory with one writing process, so mutations run one at a time.
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.catch(() => {});
    return next;
  };

  const mutation =
    <P extends string>(work: (request: Request<P>) => Promise<Response>) =>
    (request: Request<P>) =>
      serialized(() => work(request));

  /** Load a placement as the viewer would see it and render its current tree. */
  async function surface(id: string) {
    const loaded = await loadPlacement(store, id, documents);
    if (!loaded.ok) return { ok: false as const, errors: loaded.errors };
    const { package: pkg, params, state } = loaded.value;
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    const tree = await runner.render(
      pkg,
      { params, state, context: {}, data: {} },
      { ...documents, surfaceId: id, revision, timeoutMs },
    );
    if (!tree.ok) return { ok: false as const, errors: tree.errors };
    const current = {
      tree: tree.value,
      manifest: pkg.manifest,
      state,
      validator: compileValidator({ ...documents, manifest: pkg.manifest }),
    };
    served.set(id, current);
    return { ok: true as const, ...current };
  }
  const snapshot = (id: string, tree: UiTree, manifest: Manifest) => ({
    tree,
    manifest,
    actions: actions.filter((entry) => entry.placement === id),
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    maxRequestBodySize: 1048576,
    routes: {
      ...(await previewRoutes({ session, package: () => draftPackage })),
      "/": () =>
        new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }),
      "/client.js": () => new Response(bundle, { headers: { "Content-Type": "text/javascript" } }),
      "/widgets": {
        POST: mutation(async (request: Request<"/widgets">) => {
          const draft: unknown = await request.json().catch(() => undefined);
          if (!isRecord(draft)) return error("Expected a JSON draft", 400);
          const packed = pack(draft as Parameters<typeof pack>[0], documents);
          if (!packed.ok) return Response.json({ errors: packed.errors }, { status: 422 });
          const verified = verifyPackage(packed.value, documents);
          if (!verified.ok) return Response.json({ errors: verified.errors }, { status: 422 });
          try {
            await store.putPackage(verified.value);
          } catch (cause) {
            if (cause instanceof LiveframeFailure && cause.errors.some((entry) => entry.kind === "version-conflict"))
              return error("That widget version exists with different content", 409);
            throw cause;
          }
          const { id, version } = verified.value.manifest;
          return Response.json({ id, version, hash: verified.value.hash }, { status: 201 });
        }),
      },
      "/placements/:id": {
        PUT: mutation(async (request: Request<"/placements/:id">) => {
          const body: unknown = await request.json().catch(() => undefined);
          if (!isRecord(body)) return error("Expected a JSON placement", 400);
          const placement = validatePlacement({ ...body, id: request.params.id });
          if (!placement.ok) return Response.json({ errors: placement.errors }, { status: 422 });
          const { widget, params } = placement.value;
          const pkg = await store.getPackage(widget.id, widget.version);
          if (!pkg) return error("Install that widget version first", 404);
          const checked = checkValue(pkg.manifest.params, params);
          if (!checked.ok) return Response.json({ errors: checked.errors }, { status: 422 });
          await store.putPlacement(placement.value);
          served.delete(placement.value.id);
          // A new placement starts from the widget's initial state; an existing one keeps its state.
          if ((await store.getState(placement.value.id, "")) === undefined)
            await store.putState(placement.value.id, "", pkg.manifest.initialState);
          return Response.json({ id: placement.value.id });
        }),
      },
      "/placements/:id/intents": {
        POST: mutation(async (request: Request<"/placements/:id/intents">) => {
          const id = request.params.id;
          const body: unknown = await request.json().catch(() => undefined);
          if (!isRecord(body) || !isRecord(body.intent)) return error("Expected { intent }", 400);
          const intent = body.intent;
          const current = served.get(id);
          if (!current) return error("Load the surface before sending an intent", 404);
          const { manifest, state } = current;
          // Law 4: the host decides. The tree must offer the intent, then the manifest and capabilities must allow it.
          const offered = checkOffered(
            current.tree,
            body.origin as unknown as IntentOrigin,
            intent as unknown as Intent,
            current.validator,
          );
          if (!offered.ok)
            return Response.json(
              { errors: offered.errors },
              { status: offered.errors[0]?.kind === "version-conflict" ? 409 : 400 },
            );
          if (intent.type === "setState") {
            if (typeof intent.key !== "string" || !Object.hasOwn(manifest.state.properties, intent.key))
              return error("Unknown state key", 400);
            const next = { ...(state as Record<string, Json>), [intent.key]: intent.value as Json };
            if (!checkValue(manifest.state, next).ok) return error("State value does not fit the schema", 400);
            await store.putState(id, "", next);
          } else if (intent.type === "action") {
            const name = intent.name;
            const operation = typeof name === "string" ? operations[name] : undefined;
            const capability = typeof name === "string" ? capabilities.actions[name] : undefined;
            if (!operation || !capability || !manifest.actions.includes(name as string))
              return error("Action not allowed", 400);
            if (!isRecord(intent.args) || !checkValue(capability.args, intent.args).ok)
              return error("Action arguments do not fit the schema", 400);
            operation(intent.args);
            actions.push({ placement: id, name: name as string, args: intent.args });
          } else return error("Unknown intent", 400);
          const next = await surface(id);
          if (!next.ok) return Response.json({ errors: next.errors }, { status: 500 });
          return Response.json(snapshot(id, next.tree, next.manifest));
        }),
      },
      "/surfaces/:id": async (request: Request<"/surfaces/:id">) => {
        const id = request.params.id;
        const current = await serialized(() => surface(id));
        if (!current.ok)
          return Response.json({ errors: current.errors, error: "Surface unavailable" }, { status: 404 });
        return Response.json(snapshot(id, current.tree, current.manifest), {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
    error(cause) {
      console.error(cause);
      return error("Host failed to process the request", 500);
    },
  });
  return {
    url: server.url,
    actions,
    async stop() {
      await server.stop(true);
      runner.close();
    },
  };
}

if (import.meta.main) {
  const host = await startHost();
  console.log(`Liveframe demo host: ${host.url}`);
}
