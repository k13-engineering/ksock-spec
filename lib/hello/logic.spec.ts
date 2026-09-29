import assert from "node:assert";
import { describe, it } from "mocha";
import { createHelloLogic } from "./logic.ts";
import type { THelloModel } from "./model.ts";

// the logic with every model it signalled an update for
const createRecordingLogic = () => {
  let models: THelloModel[] = [];

  const logic = createHelloLogic({
    onUpdate: () => {
      models = [...models, logic.model()];
    }
  });

  return {
    logic,

    models: () => {
      return models;
    }
  };
};

describe("hello logic", () => {
  it("should start without a name", () => {
    const { logic } = createRecordingLogic();

    assert.deepStrictEqual(logic.model(), { ui: { nameInput: "" } });
  });

  it("should keep the name as typed", () => {
    const { logic, models } = createRecordingLogic();

    logic.requestNameChange({ value: " Ada" });
    logic.requestNameChange({ value: " Ada " });

    assert.deepStrictEqual(models(), [
      { ui: { nameInput: " Ada" } },
      { ui: { nameInput: " Ada " } }
    ]);
  });

  it("should not signal an update for the name it has", () => {
    const { logic, models } = createRecordingLogic();

    logic.requestNameChange({ value: "Ada" });
    logic.requestNameChange({ value: "Ada" });

    assert.strictEqual(models().length, 1);
  });
});
