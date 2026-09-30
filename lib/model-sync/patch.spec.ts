import assert from "node:assert";
import { describe, it } from "mocha";
import { applyPatch, isPatchOperation } from "./patch.ts";

describe("json patch", () => {
  it("should apply added, replaced and removed values", () => {
    const document = { a: 1, b: { c: 2 }, d: 3 };

    const patched = applyPatch({
      document,
      patch: [
        { op: "add", path: "/e", value: 4 },
        { op: "replace", path: "/b/c", value: 5 },
        { op: "remove", path: "/d" }
      ]
    });

    assert.deepStrictEqual(patched, { a: 1, b: { c: 5 }, e: 4 });
    assert.deepStrictEqual(document, { a: 1, b: { c: 2 }, d: 3 });
  });

  it("should read ~1 as / and ~0 as ~ in a path", () => {
    assert.deepStrictEqual(applyPatch({ document: {}, patch: [{ op: "add", path: "/a~1b~0c", value: 1 }] }), { "a/b~c": 1 });
  });

  it("should share what a patch did not change, frozen", () => {
    const document = Object.freeze({ a: Object.freeze({ b: 1 }), c: 2 });
    const patched = applyPatch({ document, patch: [{ op: "replace", path: "/c", value: 3 }] }) as typeof document;

    assert.strictEqual(patched.a, document.a);
    assert.ok(Object.isFrozen(patched));
  });

  it("should tell the operations of a patch from anything else", () => {
    const checked = [
      { op: "add", path: "/a", value: 1 },
      { op: "replace", path: "/a", value: undefined },
      { op: "remove", path: "/a" },
      { op: "add", path: "/a" },
      { op: "move", path: "/a", from: "/b" },
      { op: "remove", path: 1 },
      "remove /a"
    ].map((raw) => {
      return isPatchOperation(raw);
    });

    assert.deepStrictEqual(checked, [true, true, true, false, false, false, false]);
  });
});
