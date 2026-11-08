import {
  checkValue,
  type Intent,
  type IntentOrigin,
  type Json,
  LiveframeFailure,
  type Manifest,
} from "@arnilo/liveframe";
import {
  type Actions,
  type DispatchResult,
  dependents,
  type HostEvent,
  handleIntent,
  renderPlacement,
  type Served,
  type SourceCall,
  type SourceResult,
} from "@arnilo/liveframe/host";
import { pack, rebindDependencies, verifyPackage, type WidgetPackage } from "@arnilo/liveframe/pack";
import { createPreview } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { validatePlacement, verifiedPackages } from "@arnilo/liveframe/store";
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
/** Whoever the request is for. The library never looks inside: it hands it to `resolve`, `authorize` and `dispatch`. */
type Viewer = { readonly name: string; readonly may: ReadonlySet<string> };

/** The state scope. One viewer, so one scope; a multi-user host would use the user id. */
const scope = "";
/** The demo has one signed-in viewer. A real host takes this from its session. */
const viewer: Viewer = { name: "ada", may: new Set(["demo.notify", "tasks.claim", "selection.select"]) };

/**
 * Law 4: the host decides. This is a placeholder for the app's policy: it allows an action only when the viewer
 * may use it, and lets a viewer write their own state. `handleIntent` has already checked the tree offered the
 * intent, asks this for an action and a `setState` alike, and treats anything but `true` (including a throw) as a refusal.
 */
const authorize = (intent: Intent, who: Viewer) => intent.type !== "action" || who.may.has(intent.name);

const tasks: readonly { id: string; title: string }[] = [
  { id: "t1", title: "Review the release notes" },
  { id: "t2", title: "Reply to the design thread" },
  { id: "t3", title: "Triage new issues" },
  { id: "t4", title: "Update the roadmap" },
  { id: "t5", title: "Pair on the importer" },
  { id: "t6", title: "Write the migration guide" },
  { id: "t7", title: "Check the nightly build" },
  { id: "t8", title: "Rotate the API keys" },
  { id: "t9", title: "Plan the next sprint" },
  { id: "t10", title: "Archive old placements" },
  { id: "t11", title: "Tidy the backlog" },
  { id: "t12", title: "Sync with support" },
];

/**
 * What an action changes, by source name. After it settles the host asks `dependents` which placements read those
 * sources and re-renders them: widgets coordinate through capabilities, never through each other.
 */
const affects: Record<string, readonly string[]> = {
  "tasks.claim": ["tasks.page", "selection.current"],
  "selection.select": ["selection.current"],
};

const error = (message: string, status: number) => Response.json({ error: message }, { status });
const isRecord = (value: unknown): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: Json | undefined, fallback: number) => (typeof value === "number" ? value : fallback);

/** The HTTP status for a failed intent: what the sender got wrong is 4xx, what the host could not do is 500. */
function failure(errors: readonly { kind: string; pointer: string }[]): number {
  const kinds = new Set(errors.map((entry) => entry.kind));
  if (kinds.has("version-conflict")) return 409;
  if (kinds.has("limit-exceeded")) return 429;
  const hostFault = errors.some(
    (entry) =>
      entry.kind === "render-failed" ||
      entry.kind === "hash-mismatch" ||
      (entry.kind === "not-found" && !entry.pointer.startsWith("/origin")),
  );
  return hostFault ? 500 : 400;
}

export async function startHost({
  dataDir = dataDirectory,
  port = 3300,
  latencyMs = 0,
}: {
  dataDir?: string;
  port?: number;
  /** Delay `tasks.claim`, so a browser can show the pending state. */
  latencyMs?: number;
} = {}) {
  const bundle = await clientBundle;
  const store = fileStore(dataDir);
  const runner = workerRunner();
  // The preview page uses the production runner, so what an author sees is what a viewer gets.
  const session = createPreview({ ...documents, runner });
  const drafted = session.update(await readDraft(new URL("./widgets/hello/", import.meta.url).pathname));
  if (!drafted.ok) throw new AggregateError(drafted.errors, "The preview draft does not pack");
  const draftPackage = drafted.value;

  // The host's own state. The library keeps none: it gets the last accepted frame and the action statuses back
  // on every call, and hands the next ones out.
  const actions: ActionRecord[] = [];
  const events: HostEvent[] = [];
  const served = new Map<string, Served>();
  const results = new Map<string, Actions>();
  /** The last revision of a placement that was replaced, so its next tree is not mistaken for a stale one. */
  const floors = new Map<string, number>();
  const manifests = new Map<string, Manifest>();
  // The host's data. A widget only asks for it by name; `resolve` reads it as the viewer.
  const owners = new Map<string, string>();
  const selected = new Map<string, string>();

  const withOwner = (task: { id: string; title: string }) => ({ ...task, owner: owners.get(task.id) ?? "" });
  const reads: Record<string, (params: Record<string, Json>, who: Viewer) => Json> = {
    "demo.tasks": () => [...tasks],
    "tasks.page": ({ cursor, limit }) => {
      const start = integer(cursor, 0);
      const end = start + integer(limit, 5);
      return { items: tasks.slice(start, end).map(withOwner), more: end < tasks.length };
    },
    "selection.current": (_params, who) => {
      const task = tasks.find((entry) => entry.id === selected.get(who.name));
      return task ? withOwner(task) : { id: "", title: "Nothing selected", owner: "" };
    },
  };
  /** Read every source of one render as the viewer. A source this host does not offer is `unavailable`. */
  const resolve = async (calls: readonly SourceCall[], who: Viewer): Promise<Record<string, SourceResult>> =>
    Object.fromEntries(
      calls.map(({ alias, source, params }) => {
        const read = reads[source];
        const answer: SourceResult = read
          ? { ok: true, value: read(isRecord(params) ? params : {}, who) }
          : { ok: false, reason: "unavailable" };
        return [alias, answer];
      }),
    );

  /** The host's operations, run as the viewer after `checkOffered` and `authorize`. Add a timeout to real ones. */
  const dispatcher =
    (placement: string) =>
    async (intent: Intent, who: Viewer): Promise<DispatchResult> => {
      if (intent.type !== "action" || !isRecord(intent.args)) return { ok: false };
      const { id, message } = intent.args;
      if (intent.name === "demo.notify") console.log(`demo.notify: ${String(message)}`);
      else if (intent.name === "selection.select") selected.set(who.name, String(id));
      else if (intent.name === "tasks.claim") {
        if (latencyMs) await Bun.sleep(latencyMs);
        if (owners.has(String(id))) return { ok: false, reason: "Already claimed" };
        owners.set(String(id), who.name);
      } else return { ok: false };
      actions.push({ placement, name: intent.name, args: intent.args });
      return intent.name === "tasks.claim" ? { ok: true, value: { owner: who.name } } : { ok: true };
    };

  // Injected once, spread into every call (spec §7.7).
  const wiring = {
    store,
    runner,
    installs: { [catalog.catalogId]: documents },
    resolve,
    verified: verifiedPackages(),
    runOptions: { timeoutMs },
    onEvent: (event: HostEvent) => {
      events.push(event);
      if (events.length > 200) events.shift();
    },
  };

  /** Render a placement as the viewer would see it now. An unchanged render comes back as `previous`. */
  async function surface(id: string) {
    const previous = served.get(id);
    const rendered = await renderPlacement({
      ...wiring,
      placementId: id,
      catalogId: catalog.catalogId,
      scope,
      viewer,
      context: {},
      actions: results.get(id) ?? {},
      ...(previous ? { previous } : { revision: (floors.get(id) ?? 0) + 1 }),
    });
    if (rendered.ok) {
      served.set(id, rendered.value);
      // A placement moved to a new widget version: the library mapped its old state (`migrateState`); keeping it is ours.
      if (rendered.value.migrated) await store.putState(id, scope, rendered.value.state);
    }
    return rendered;
  }

  async function manifestOf(frame: Served): Promise<Manifest> {
    const cached = manifests.get(frame.package.hash);
    if (cached) return cached;
    const pkg = await store.getPackage(frame.package.id, frame.package.version);
    if (!pkg) throw new Error("The served package is not installed");
    manifests.set(pkg.hash, pkg.manifest);
    return pkg.manifest;
  }

  /**
   * What goes to the client. It gets the patch only when it holds the patch's base; anyone else gets the whole tree
   * (spec §7.7). `accepted` maps a placement to the revision the client last accepted, and is updated as frames go.
   */
  async function frame(next: Served, accepted: Map<string, number>) {
    const patch = next.patch && accepted.get(next.placementId) === next.patch.base ? next.patch : undefined;
    accepted.set(next.placementId, next.revision);
    return {
      placement: next.placementId,
      revision: next.revision,
      manifest: await manifestOf(next),
      ...(patch ? { patch } : { tree: next.tree }),
      actions: actions.filter((entry) => entry.placement === next.placementId),
    };
  }
  const revisionsFrom = (value: unknown): Map<string, number> =>
    new Map(
      isRecord(value)
        ? Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number")
        : [],
    );

  /**
   * The installed library packages a draft imports (`liveframe:lib/<id>@<version>`), with theirs in turn, so
   * `pack` can pin them by hash. A library that is not installed is simply not supplied, and `pack` says so.
   */
  async function librariesFor(sources: Iterable<string>): Promise<WidgetPackage[]> {
    const found = new Map<string, WidgetPackage>();
    const pending = [...sources].flatMap((text) => [...text.matchAll(/liveframe:lib\/([^@"'\s]+)@([^"'\s]+)/g)]);
    const wanted = pending.map((match) => [match[1] as string, match[2] as string] as const);
    for (let next = wanted.shift(); next; next = wanted.shift()) {
      const [id, version] = next;
      if (found.has(`${id}@${version}`)) continue;
      const library = await store.getPackage(id, version);
      if (!library) continue;
      found.set(`${id}@${version}`, library);
      for (const pin of library.manifest.dependencies ?? []) wanted.push([pin.id, pin.version]);
    }
    return [...found.values()];
  }

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

  /**
   * Run `work` in turn and send each frame it emits as a line of JSON, as it happens: a claim's `pending` frame
   * reaches the client before the operation finishes. Until the first frame, `work` can still answer with a plain
   * response, which is how a refused intent gets its status code.
   */
  function streamed(work: (emit: (line: unknown) => void) => Promise<Response | undefined>): Promise<Response> {
    return new Promise((resolve) => {
      const encoder = new TextEncoder();
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      const emit = (line: unknown) => {
        const bytes = encoder.encode(`${JSON.stringify(line)}\n`);
        if (controller) return controller.enqueue(bytes);
        resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(opened) {
                controller = opened;
                opened.enqueue(bytes);
              },
            }),
            { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } },
          ),
        );
      };
      serialized(() => work(emit)).then(
        (answer) => (controller ? controller.close() : resolve(answer ?? new Response(null, { status: 204 }))),
        (cause) => {
          console.error(cause);
          if (controller) controller.error(cause);
          else resolve(error("Host failed to process the request", 500));
        },
      );
    });
  }

  /** One intent from the client. Its answer is a stream of frames (see `streamed`). */
  async function sendIntent(request: Request<"/placements/:id/intents">) {
    const id = request.params.id;
    const body: unknown = await request.json().catch(() => undefined);
    if (!isRecord(body) || !isRecord(body.intent) || !isRecord(body.origin))
      return error("Expected { intent, origin }", 400);
    const { intent, origin } = body as { intent: Intent; origin: IntentOrigin };
    const accepted = revisionsFrom(body.accepted);
    return streamed(async (emit) => {
      const current = served.get(id);
      if (!current) return error("Load the surface before sending an intent", 404);
      // Check, then authorise, then act: the library fixes that order (law 4). Every frame it renders is
      // pushed as it is made, so `pending` is seen before the operation finishes.
      const handled = await handleIntent({
        ...wiring,
        served: current,
        origin,
        intent,
        viewer,
        context: {},
        actions: results.get(id) ?? {},
        authorize,
        dispatch: dispatcher(id),
        publish: async (next) => {
          served.set(id, next);
          emit(await frame(next, accepted));
        },
      });
      if (!handled.ok) return Response.json({ errors: handled.errors }, { status: failure(handled.errors) });
      served.set(id, handled.value.served);
      results.set(id, handled.value.actions);
      // The action may have changed what other placements read: re-render exactly those.
      if (intent.type === "action") {
        const readers = [...served.values()];
        const stale = new Set((affects[intent.name] ?? []).flatMap((source) => dependents(readers, { source })));
        stale.delete(id);
        for (const other of stale) {
          const next = await surface(other);
          emit(next.ok ? await frame(next.value, accepted) : { placement: other, error: "Surface unavailable" });
        }
      }
      return undefined;
    });
  }

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
          const files = isRecord(draft.files) ? Object.values(draft.files).map(String) : [];
          const libraries = await librariesFor(files);
          const packed = pack(draft as Parameters<typeof pack>[0], { ...documents, libraries });
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
      // A new version of a widget on new versions of the libraries it pins, without its source: the code is the
      // same bytes except the version in each library's header line (spec §7.3).
      "/widgets/:id/:version/rebind": {
        POST: mutation(async (request: Request<"/widgets/:id/:version/rebind">) => {
          const body: unknown = await request.json().catch(() => undefined);
          if (!isRecord(body) || typeof body.version !== "string" || !Array.isArray(body.libraries))
            return error("Expected { version, libraries: [{ id, version }] }", 400);
          const pkg = await store.getPackage(request.params.id, request.params.version);
          if (!pkg) return error("That widget version is not installed", 404);
          const libraries: WidgetPackage[] = [];
          for (const wanted of body.libraries) {
            const library = isRecord(wanted)
              ? await store.getPackage(String(wanted.id), String(wanted.version))
              : undefined;
            if (!library) return error("Install that library version first", 404);
            libraries.push(library);
          }
          const rebound = rebindDependencies(pkg, { libraries, version: body.version });
          if (!rebound.ok) return Response.json({ errors: rebound.errors }, { status: 422 });
          const verified = verifyPackage(rebound.value, { ...documents, libraries });
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
          // The next tree is a different widget's: forget the old frame, but keep counting revisions from it.
          const { id } = placement.value;
          floors.set(id, served.get(id)?.revision ?? floors.get(id) ?? 0);
          served.delete(id);
          results.delete(id);
          // A new placement starts from the widget's initial state; an existing one keeps its state.
          if ((await store.getState(id, scope)) === undefined)
            await store.putState(id, scope, pkg.manifest.initialState);
          return Response.json({ id });
        }),
      },
      "/placements/:id/intents": {
        POST: sendIntent,
      },
      "/surfaces/:id": async (request: Request<"/surfaces/:id">) => {
        const id = request.params.id;
        const base = Number(new URL(request.url).searchParams.get("base"));
        const rendered = await serialized(() => surface(id));
        if (!rendered.ok)
          return Response.json({ errors: rendered.errors, error: "Surface unavailable" }, { status: 404 });
        const accepted = new Map(Number.isInteger(base) && base > 0 ? [[id, base] as const] : []);
        return Response.json(await frame(rendered.value, accepted), { headers: { "Cache-Control": "no-store" } });
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
    events,
    async stop() {
      await server.stop(true);
      runner.close();
    },
  };
}

if (import.meta.main) {
  const host = await startHost({ latencyMs: 600 });
  console.log(`Liveframe demo host: ${host.url}`);
}
