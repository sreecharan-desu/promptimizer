import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheGet, cacheSet, clearOwnerCaches, userCacheKey } from "./upstash";

describe("owner cache clearing", () => {
  it("deletes tracked keys for an owner", async () => {
    const owner = `clear-test-${Date.now()}`;
    const exact = userCacheKey(owner, "exact", "abc");
    const prompt = userCacheKey(owner, "prompt", "m1", "hi");
    const semantic = userCacheKey(owner, "semantic", "index");
    await cacheSet(exact, { ok: 1 });
    await cacheSet(prompt, { ok: 2 });
    await cacheSet(semantic, [{ id: "x" }]);

    assert.ok(await cacheGet(exact));
    assert.ok(await cacheGet(prompt));

    const { deleted } = await clearOwnerCaches(owner);
    assert.ok(deleted >= 3, `expected ≥3 deleted, got ${deleted}`);
    assert.equal(await cacheGet(exact), undefined);
    assert.equal(await cacheGet(prompt), undefined);
    assert.equal(await cacheGet(semantic), undefined);
  });

  it("does not clear another owner's keys", async () => {
    const a = `owner-a-${Date.now()}`;
    const b = `owner-b-${Date.now()}`;
    const keyA = userCacheKey(a, "exact", "1");
    const keyB = userCacheKey(b, "exact", "1");
    await cacheSet(keyA, { owner: "a" });
    await cacheSet(keyB, { owner: "b" });
    await clearOwnerCaches(a);
    assert.equal(await cacheGet(keyA), undefined);
    assert.deepEqual(await cacheGet(keyB), { owner: "b" });
    await clearOwnerCaches(b);
  });
});
