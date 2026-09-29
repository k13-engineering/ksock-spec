import { memoize } from "proxy-memoize";
import type { TInputViewModel } from "../../frontend/components/input/view-model.ts";
import type { THelloLogic } from "./logic.ts";
import type { THelloModel } from "./model.ts";

type THelloPageViewModel = {
  greeting: string;
  nameInput: TInputViewModel;
};

// whom the page greets: the name typed, or the world while there is none
const addresseeOf = ({ nameInput }: { nameInput: string }) => {
  const name = nameInput.trim();
  return name === "" ? "World" : name;
};

const createHelloPageViewModel = memoize(({ model, logic }: { model: THelloModel, logic: THelloLogic }): THelloPageViewModel => {
  return {
    greeting: `Hello, ${addresseeOf({ nameInput: model.ui.nameInput })}!`,

    nameInput: {
      value: model.ui.nameInput,
      onInput: ({ value }) => {
        logic.requestNameChange({ value });
      }
    }
  };
});

export {
  createHelloPageViewModel
};

export type {
  THelloPageViewModel
};
