import { createModelStore } from "../model-store.ts";
import { initialHelloModel, type THelloModel } from "./model.ts";

type THelloLogic = {
  // the current model, pulled, never pushed
  model: () => THelloModel;

  requestNameChange: (args: { value: string }) => void;
};

const createHelloLogic = ({ onUpdate }: { onUpdate: () => void }): THelloLogic => {
  const store = createModelStore<THelloModel>({ initial: initialHelloModel, onUpdate });

  return {
    model: store.model,

    requestNameChange: ({ value }) => {
      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.nameInput = value;
        }
      });
    }
  };
};

export {
  createHelloLogic
};

export type {
  THelloLogic
};
