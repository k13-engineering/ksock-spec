import assert from "node:assert";
import { describe, it } from "mocha";
import type { TPatchOperation } from "../model-sync/patch.ts";
import { createLampLogic } from "./logic.ts";
import { EConnection } from "./model.ts";
import type { TDieRoll, TSwitchLamp } from "./protocol.ts";

// the patch the server sends first, with all of the backend model
const firstPatch = ({ on = false, requestSequence = 0 }: { on?: boolean, requestSequence?: number } = {}): TPatchOperation[] => {
  return [
    { op: "add", path: "/lamp", value: { on } },
    { op: "add", path: "/requestSequence", value: requestSequence }
  ];
};

// the logic with a backend that records the switches and answers the rolls when the test says so
const createTestLogic = () => {
  let switches: TSwitchLamp[] = [];
  let answerRoll: (roll: TDieRoll | undefined) => void = () => {};
  let updates = 0;

  const logic = createLampLogic({
    backend: {
      switchLamp: (params) => {
        switches = [...switches, params];
      },

      rollDie: () => {
        return new Promise((resolve) => {
          answerRoll = resolve;
        });
      }
    },

    onUpdate: () => {
      updates += 1;
    }
  });

  return {
    logic,

    switches: () => {
      return switches;
    },

    answerRoll: ({ roll }: { roll: TDieRoll | undefined }) => {
      answerRoll(roll);
    },

    updates: () => {
      return updates;
    },

    // connected, with the backend model of the first patch
    ready: ({ on, requestSequence }: { on?: boolean, requestSequence?: number } = {}) => {
      logic.connected();
      logic.modelPatchFromBackend({ patch: firstPatch({ on, requestSequence }) });
    }
  };
};

describe("lamp logic", () => {
  it("should start connecting, without the backend model", () => {
    const { logic } = createTestLogic();

    assert.deepStrictEqual(logic.model(), {
      backend: { connection: EConnection.CONNECTING, model: undefined },
      ui: { switchRequestSequence: 0, dieRolling: false, dieValue: undefined }
    });
  });

  it("should follow the connection", () => {
    const { logic } = createTestLogic();

    logic.connected();
    assert.strictEqual(logic.model().backend.connection, EConnection.OPEN);

    logic.connectionLost();
    assert.strictEqual(logic.model().backend.connection, EConnection.CLOSED);
  });

  it("should make the backend model of the patches, sharing what they did not change", () => {
    const { logic, ready } = createTestLogic();

    ready();
    const before = logic.model().backend.model;
    logic.modelPatchFromBackend({ patch: [{ op: "replace", path: "/requestSequence", value: 1 }] });

    assert.deepStrictEqual(logic.model().backend.model, { lamp: { on: false }, requestSequence: 1 });
    assert.strictEqual(logic.model().backend.model?.lamp, before?.lamp);
  });

  it("should ignore a patch that does not make a backend model of the lamp", () => {
    const { logic, ready, updates } = createTestLogic();

    ready();
    const updatesBefore = updates();
    logic.modelPatchFromBackend({ patch: [{ op: "remove", path: "/lamp" }] });

    assert.strictEqual(updates(), updatesBefore);
  });

  it("should request a switch with the mirrored sequence plus one, to the other state of the lamp", () => {
    const { logic, ready, switches } = createTestLogic();

    ready({ on: true, requestSequence: 6 });
    logic.requestSwitch();

    assert.deepStrictEqual(switches(), [{ requestSequence: 7, on: false }]);
    assert.strictEqual(logic.model().ui.switchRequestSequence, 7);
  });

  it("should have one switch pending at a time, until the backend model mirrors it", () => {
    const { logic, ready, switches } = createTestLogic();

    ready();
    logic.requestSwitch();
    logic.requestSwitch();

    assert.strictEqual(switches().length, 1);

    logic.modelPatchFromBackend({ patch: [{ op: "replace", path: "/requestSequence", value: 1 }] });
    logic.requestSwitch();

    assert.deepStrictEqual(switches().map(({ requestSequence }) => {
      return requestSequence;
    }), [1, 2]);
  });

  it("should not switch before it has the backend model, or while not connected", () => {
    const { logic, switches } = createTestLogic();

    logic.connected();
    logic.requestSwitch();
    logic.connectionLost();
    logic.modelPatchFromBackend({ patch: firstPatch() });
    logic.requestSwitch();

    assert.deepStrictEqual(switches(), []);
  });

  it("should roll the die out of band, and keep what it came to", async () => {
    const { logic, ready, answerRoll } = createTestLogic();

    ready();
    const rolling = logic.requestRoll();

    assert.strictEqual(logic.model().ui.dieRolling, true);

    answerRoll({ roll: { value: 4 } });
    await rolling;

    assert.deepStrictEqual(logic.model().ui, { switchRequestSequence: 0, dieRolling: false, dieValue: 4 });
  });

  it("should keep the last value when a roll fails", async () => {
    const { logic, ready, answerRoll } = createTestLogic();

    ready();
    const first = logic.requestRoll();
    answerRoll({ roll: { value: 4 } });
    await first;
    const second = logic.requestRoll();
    answerRoll({ roll: undefined });
    await second;

    assert.deepStrictEqual(logic.model().ui, { switchRequestSequence: 0, dieRolling: false, dieValue: 4 });
  });

  it("should roll one die at a time, and only while connected", async () => {
    const { logic, ready, updates } = createTestLogic();

    await logic.requestRoll();
    assert.strictEqual(updates(), 0);

    ready();
    void logic.requestRoll();
    const updatesRolling = updates();
    await logic.requestRoll();

    assert.strictEqual(updates(), updatesRolling);
  });
});
