import assert from "node:assert";
import { describe, it } from "mocha";
import type { TPatchOperation } from "./patch.ts";
import { createModelSender } from "./sender.ts";

type TTestModel = { lamp: { on: boolean }, requestSequence: number };

const createTestSender = () => {
  let patches: TPatchOperation[][] = [];
  let writable = true;

  const sender = createModelSender<TTestModel>({
    send: ({ patch }) => {
      patches = [...patches, patch];
    },
    writable: () => {
      return writable;
    }
  });

  return {
    sender,

    patches: () => {
      return patches;
    },

    setWritable: ({ value }: { value: boolean }) => {
      writable = value;
    }
  };
};

describe("model sender", () => {
  it("should send all of the model in the first patch", () => {
    const { sender, patches } = createTestSender();

    sender.changed({ model: { lamp: { on: false }, requestSequence: 0 } });

    assert.deepStrictEqual(patches(), [[
      { op: "add", path: "/lamp", value: { on: false } },
      { op: "add", path: "/requestSequence", value: 0 }
    ]]);
  });

  it("should send what changed since, and nothing if nothing changed", () => {
    const { sender, patches } = createTestSender();

    sender.changed({ model: { lamp: { on: false }, requestSequence: 0 } });
    sender.changed({ model: { lamp: { on: true }, requestSequence: 1 } });
    sender.changed({ model: { lamp: { on: true }, requestSequence: 1 } });

    assert.deepStrictEqual(patches().slice(1), [[
      { op: "replace", path: "/requestSequence", value: 1 },
      { op: "replace", path: "/lamp/on", value: true }
    ]]);
  });

  it("should wait while the connection is not writable, and then send the changes in between as one patch", () => {
    const { sender, patches, setWritable } = createTestSender();

    sender.changed({ model: { lamp: { on: false }, requestSequence: 0 } });
    setWritable({ value: false });
    sender.changed({ model: { lamp: { on: true }, requestSequence: 1 } });
    sender.changed({ model: { lamp: { on: false }, requestSequence: 2 } });

    assert.strictEqual(patches().length, 1);

    setWritable({ value: true });
    sender.writable();

    assert.deepStrictEqual(patches().slice(1), [[{ op: "replace", path: "/requestSequence", value: 2 }]]);
  });

  it("should send nothing before it has a model", () => {
    const { sender, patches } = createTestSender();

    sender.writable();

    assert.deepStrictEqual(patches(), []);
  });
});
