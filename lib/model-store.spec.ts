import assert from "node:assert";
import { describe, it } from "mocha";
import { createModelStore } from "./model-store.ts";

type TTestModel = {
  a: { value: number };
  b: { value: number };
};

const createRecordingStore = () => {
  let updates = 0;

  const store = createModelStore<TTestModel>({
    initial: { a: { value: 1 }, b: { value: 2 } },
    onUpdate: () => {
      updates += 1;
    }
  });

  return {
    store,

    updates: () => {
      return updates;
    }
  };
};

describe("model store", () => {
  it("should hand out the initial model deeply frozen", () => {
    const { store } = createRecordingStore();

    assert.ok(Object.isFrozen(store.model()));
    assert.ok(Object.isFrozen(store.model().a));
  });

  it("should replace the model and signal an update when a recipe changes the draft", () => {
    const { store, updates } = createRecordingStore();
    const before = store.model();

    store.update({
      recipe: ({ draft }) => {
        // eslint-disable-next-line immutable/no-mutation
        draft.a.value = 3;
      }
    });

    assert.deepStrictEqual(store.model(), { a: { value: 3 }, b: { value: 2 } });
    assert.strictEqual(updates(), 1);
    assert.ok(Object.isFrozen(store.model().a));
    // the old model stays as it was, and shares what the recipe did not change
    assert.deepStrictEqual(before, { a: { value: 1 }, b: { value: 2 } });
    assert.strictEqual(store.model().b, before.b);
  });

  it("should keep the model and not signal an update when a recipe changes nothing", () => {
    const { store, updates } = createRecordingStore();
    const before = store.model();

    store.update({
      recipe: ({ draft }) => {
        // eslint-disable-next-line immutable/no-mutation
        draft.a.value = 1;
      }
    });

    assert.strictEqual(store.model(), before);
    assert.strictEqual(updates(), 0);
  });
});
