import { expect, test } from "bun:test";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import type { Store } from "@arnilo/liveframe/store";
import manifestDoc from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const manifest = manifestDoc as WidgetPackage["manifest"];

export const pkg: WidgetPackage = {
  format: "liveframe-package/1",
  manifest,
  code: "export default () => null;",
  scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
  hash: `sha256-${"0".repeat(64)}`,
};
export const placement = {
  id: "home",
  slot: "main",
  widget: { id: manifest.id, version: manifest.version },
  params: { nested: [1] },
};

export function storeContract(name: string, createStore: () => Store | Promise<Store>) {
  test(`${name}_store_rules`, async () => {
    const store = await createStore();
    expect(await store.getPackage("missing", "1")).toBeUndefined();
    expect(await store.getState("missing")).toBeUndefined();
    expect(await store.getStyle("theme", "missing", "1")).toBeUndefined();
    await store.putPackage(pkg);
    await store.putPackage({ ...pkg, code: "ignored same-hash content" });
    expect(await store.getPackage(manifest.id, manifest.version)).toEqual(pkg);
    await expect(store.putPackage({ ...pkg, hash: `sha256-${"1".repeat(64)}` })).rejects.toMatchObject({
      kind: "version-conflict",
    });
    await store.putPackage({ ...pkg, manifest: { ...manifest, version: "2" } });
    await store.putPlacement(placement);
    await store.putPlacement({ ...placement, id: "a" });
    expect((await store.listPlacements()).map((p) => p.id)).toEqual(["a", "home"]);
    await store.putPlacement({ ...placement, slot: "other" });
    expect((await store.listPlacements())[1]?.slot).toBe("other");
    await store.putState("home", null);
    expect(await store.getState("home")).toBeNull();
    await store.putState("home", false);
    expect(await store.getState("home")).toBe(false);
    await store.deletePlacement("home");
    expect(await store.getState("home")).toBeUndefined();
    expect((await store.listPlacements()).map((p) => p.id)).toEqual(["a"]);
    await store.putState("orphan", 1);
    await store.deletePlacement("orphan");
    expect(await store.getState("orphan")).toBeUndefined();
    expect(await store.getPackage(manifest.id, manifest.version)).toEqual(pkg);
    expect(await (await createStore()).listPlacements()).toEqual([]);
  });

  test(`${name}_store_copies_every_record_on_put_and_get`, async () => {
    const store = await createStore();
    const input = JSON.parse(JSON.stringify(pkg));
    await store.putPackage(input);
    input.manifest.id = "changed";
    const read = await store.getPackage(manifest.id, manifest.version);
    expect(read).toEqual(pkg);
    (read as typeof input).scenarios[0].name = "changed";
    expect(await store.getPackage(manifest.id, manifest.version)).toEqual(pkg);

    const placed = JSON.parse(JSON.stringify(placement));
    await store.putPlacement(placed);
    placed.params.nested.push(2);
    const listed = await store.listPlacements();
    const first = listed[0];
    if (!first) throw new Error("Missing placement");
    expect(first.params).toEqual({ nested: [1] });
    (first.params as { nested: number[] }).nested.push(3);
    expect((await store.listPlacements())[0]?.params).toEqual({ nested: [1] });

    const state = { nested: [1] };
    await store.putState("home", state);
    state.nested.push(2);
    const saved = await store.getState("home");
    expect(saved).toEqual({ nested: [1] });
    (saved as typeof state).nested.push(3);
    expect(await store.getState("home")).toEqual({ nested: [1] });

    const style = { kind: "theme" as const, id: "test", version: "1", body: { nested: [1] } };
    await store.putStyle(style);
    style.body.nested.push(2);
    const styled = await store.getStyle("theme", "test", "1");
    if (!styled) throw new Error("Missing style");
    expect(styled.body).toEqual({ nested: [1] });
    (styled.body as typeof state).nested.push(3);
    expect((await store.getStyle("theme", "test", "1"))?.body).toEqual({ nested: [1] });
    for (const variant of [
      { ...style, version: "2" },
      { ...style, id: "other" },
      { ...style, kind: "designSystem" as const },
    ]) {
      await store.putStyle(variant);
      expect(await store.getStyle(variant.kind, variant.id, variant.version)).toEqual(variant);
    }
  });
}
