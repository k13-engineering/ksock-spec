import assert from "node:assert";
import { describe, it } from "mocha";
import type { TLampLogic } from "./logic.ts";
import { EConnection, type TLampModel } from "./model.ts";
import type { TLampBackendModel } from "./protocol.ts";
import { createLampViewModel } from "./view-model.ts";

const createFakeLogic = () => {
  let requests: string[] = [];

  const logic: TLampLogic = {
    model: () => {
      return assert.fail("the view model gets the model passed in");
    },
    requestSwitch: () => {
      requests = [...requests, "switch"];
    },
    requestRoll: async () => {
      requests = [...requests, "roll"];
    },
    connected: () => {
      assert.fail("only the connection reports it");
    },
    connectionLost: () => {
      assert.fail("only the connection reports it");
    },
    modelPatchFromBackend: () => {
      assert.fail("only the connection reports patches");
    }
  };

  return {
    logic,

    requests: () => {
      return requests;
    }
  };
};

// the model of a connected page with the lamp off, and the overrides, which can also be undefined
const createModel = (overrides: {
  connection?: EConnection,
  backendModel?: TLampBackendModel | undefined,
  switchRequestSequence?: number,
  dieRolling?: boolean,
  dieValue?: number | undefined
}): TLampModel => {
  const { connection, backendModel, switchRequestSequence, dieRolling, dieValue } = {
    connection: EConnection.OPEN,
    backendModel: { lamp: { on: false }, requestSequence: 0 },
    switchRequestSequence: 0,
    dieRolling: false,
    dieValue: undefined,
    ...overrides
  };

  return {
    backend: { connection, model: backendModel },
    ui: { switchRequestSequence, dieRolling, dieValue }
  };
};

describe("lamp view model", () => {
  it("should show the connection with a text and a color", () => {
    const { logic } = createFakeLogic();

    const statuses = [EConnection.CONNECTING, EConnection.OPEN, EConnection.CLOSED].map((connection) => {
      return createLampViewModel({ model: createModel({ connection }), logic }).status;
    });

    assert.deepStrictEqual(statuses, [
      { text: "connecting…", color: "#c98a0b" },
      { text: "connected", color: "#1f8a3b" },
      { text: "disconnected, reload the page to connect again", color: "#b3261e" }
    ]);
  });

  it("should have no lamp, and wait for the backend model, until it arrived", () => {
    const { logic } = createFakeLogic();
    const viewModel = createLampViewModel({ model: createModel({ backendModel: undefined }), logic });

    assert.strictEqual(viewModel.lamp, undefined);
    assert.strictEqual(viewModel.modelText, "waiting for the first patch…");
  });

  it("should show the backend model as it is", () => {
    const { logic } = createFakeLogic();
    const viewModel = createLampViewModel({ model: createModel({}), logic });

    assert.deepStrictEqual(JSON.parse(viewModel.modelText), { lamp: { on: false }, requestSequence: 0 });
  });

  it("should show the lamp on and off, with the button to switch it the other way", () => {
    const { logic } = createFakeLogic();

    const looks = [false, true].map((on) => {
      const lamp = createLampViewModel({ model: createModel({ backendModel: { lamp: { on }, requestSequence: 0 } }), logic }).lamp;
      return { text: lamp?.text, color: lamp?.color, label: lamp?.buttonSwitch.label };
    });

    assert.deepStrictEqual(looks, [
      { text: "The lamp is off.", color: "#c8c8c2", label: "Switch on" },
      { text: "The lamp is on.", color: "#f5c542", label: "Switch off" }
    ]);
  });

  it("should spin the switch button, and not take another switch, while its request is pending", () => {
    const { logic } = createFakeLogic();
    const lamp = createLampViewModel({ model: createModel({ switchRequestSequence: 1 }), logic }).lamp;

    assert.strictEqual(lamp?.buttonSwitch.busy, true);
    assert.strictEqual(lamp?.buttonSwitch.enabled, false);
    assert.strictEqual(lamp?.note, "Request 1 sent. The button spins until the backend model mirrors its sequence.");
  });

  it("should tell what became of the switch requests", () => {
    const { logic } = createFakeLogic();

    const notes = [0, 3].map((requestSequence) => {
      const backendModel = { lamp: { on: true }, requestSequence };
      return createLampViewModel({ model: createModel({ backendModel, switchRequestSequence: requestSequence }), logic }).lamp?.note;
    });

    assert.deepStrictEqual(notes, [
      "No request yet. The backend model mirrors the sequence 0.",
      "Request 3 done: the backend model mirrors its sequence, and shows its result."
    ]);
  });

  it("should take switches and rolls only while connected", () => {
    const { logic } = createFakeLogic();
    const viewModel = createLampViewModel({ model: createModel({ connection: EConnection.CLOSED }), logic });

    assert.strictEqual(viewModel.lamp?.buttonSwitch.enabled, false);
    assert.strictEqual(viewModel.die.buttonRoll.enabled, false);
  });

  it("should spin the roll button while the die rolls, and tell what it came to", () => {
    const { logic } = createFakeLogic();
    const rolling = createLampViewModel({ model: createModel({ dieRolling: true }), logic }).die;
    const rolled = createLampViewModel({ model: createModel({ dieValue: 4 }), logic }).die;

    assert.deepStrictEqual([rolling.buttonRoll.busy, rolling.buttonRoll.enabled, rolling.resultText], [true, false, "Not rolled yet."]);
    assert.deepStrictEqual([rolled.buttonRoll.busy, rolled.buttonRoll.enabled], [false, true]);
    assert.match(rolled.resultText, /^You rolled a 4\./);
  });

  it("should request a switch and a roll for clicks of their buttons", () => {
    const { logic, requests } = createFakeLogic();
    const viewModel = createLampViewModel({ model: createModel({}), logic });

    viewModel.lamp?.buttonSwitch.onClicked({ event: new Event("click") });
    viewModel.die.buttonRoll.onClicked({ event: new Event("click") });

    assert.deepStrictEqual(requests(), ["switch", "roll"]);
  });

  it("should return the same view model for an equal model", () => {
    const { logic } = createFakeLogic();

    const first = createLampViewModel({ model: createModel({}), logic });
    const second = createLampViewModel({ model: createModel({}), logic });

    assert.strictEqual(second, first);
  });

  it("should keep the die while only the lamp changes, and the lamp while only the die changes", () => {
    const { logic } = createFakeLogic();

    const first = createLampViewModel({ model: createModel({}), logic });
    const lampChanged = createLampViewModel({ model: createModel({ switchRequestSequence: 1 }), logic });
    const dieChanged = createLampViewModel({ model: createModel({ switchRequestSequence: 1, dieRolling: true }), logic });

    assert.strictEqual(lampChanged.die, first.die);
    assert.notStrictEqual(lampChanged.lamp, first.lamp);
    assert.strictEqual(dieChanged.lamp, lampChanged.lamp);
  });
});
