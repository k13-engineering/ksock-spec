import assert from "node:assert";
import { describe, it } from "mocha";
import type { THelloLogic } from "./logic.ts";
import type { THelloModel } from "./model.ts";
import { createHelloPageViewModel } from "./view-model.ts";

const createFakeLogic = () => {
  let nameRequests: string[] = [];

  const logic: THelloLogic = {
    model: () => {
      return assert.fail("the view model gets the model passed in");
    },

    requestNameChange: ({ value }) => {
      nameRequests = [...nameRequests, value];
    }
  };

  return {
    logic,

    nameRequests: () => {
      return nameRequests;
    }
  };
};

const createModel = ({ nameInput }: { nameInput: string }): THelloModel => {
  return { ui: { nameInput } };
};

describe("hello view model", () => {
  it("should greet the world while there is no name", () => {
    const { logic } = createFakeLogic();

    assert.strictEqual(createHelloPageViewModel({ model: createModel({ nameInput: "" }), logic }).greeting, "Hello, World!");
  });

  it("should greet the world for a name of blanks", () => {
    const { logic } = createFakeLogic();

    assert.strictEqual(createHelloPageViewModel({ model: createModel({ nameInput: "  " }), logic }).greeting, "Hello, World!");
  });

  it("should greet the name without the blanks around it", () => {
    const { logic } = createFakeLogic();

    assert.strictEqual(createHelloPageViewModel({ model: createModel({ nameInput: " Ada " }), logic }).greeting, "Hello, Ada!");
  });

  it("should show the name in the input as typed", () => {
    const { logic } = createFakeLogic();

    assert.strictEqual(createHelloPageViewModel({ model: createModel({ nameInput: " Ada " }), logic }).nameInput.value, " Ada ");
  });

  it("should request a new name for an edit of the input", () => {
    const { logic, nameRequests } = createFakeLogic();

    createHelloPageViewModel({ model: createModel({ nameInput: "Ada" }), logic }).nameInput.onInput({ value: "Adam" });

    assert.deepStrictEqual(nameRequests(), ["Adam"]);
  });

  it("should return the same view model for an equal model", () => {
    const { logic } = createFakeLogic();

    const first = createHelloPageViewModel({ model: createModel({ nameInput: "Ada" }), logic });
    const second = createHelloPageViewModel({ model: createModel({ nameInput: "Ada" }), logic });

    assert.strictEqual(second, first);
  });

  it("should make a new view model for another name", () => {
    const { logic } = createFakeLogic();

    const first = createHelloPageViewModel({ model: createModel({ nameInput: "Ada" }), logic });
    const second = createHelloPageViewModel({ model: createModel({ nameInput: "Adam" }), logic });

    assert.notStrictEqual(second, first);
  });

  it("should make new handlers for another logic", () => {
    const model = createModel({ nameInput: "Ada" });
    const first = createFakeLogic();
    const second = createFakeLogic();

    createHelloPageViewModel({ model, logic: first.logic });
    createHelloPageViewModel({ model, logic: second.logic }).nameInput.onInput({ value: "Adam" });

    assert.deepStrictEqual(first.nameRequests(), []);
    assert.deepStrictEqual(second.nameRequests(), ["Adam"]);
  });
});
