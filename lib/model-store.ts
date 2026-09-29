import { freeze, produce, type Draft } from "immer";

type TRecipe<TModel> = (args: { draft: Draft<TModel> }) => void;

/*
 * The one current model of a logic, frozen deeply like every model immer produces, so no model can be changed by
 * accident. A recipe changes a draft of the model, from which immer produces the new model: the changed parts are
 * new objects, the others are shared with the current model, and all of it is frozen. If the recipe changed nothing,
 * e.g. assigned the value a property already had, immer returns the current model and no update is signalled.
 *
 * The immutable/no-mutation rule cannot tell a draft from the model, so it is switched off for each assignment to a
 * draft.
 */
const createModelStore = <TModel extends object>({ initial, onUpdate }: { initial: TModel, onUpdate: () => void }) => {
  let model = freeze(initial, true);

  return {
    model: () => {
      return model;
    },

    update: ({ recipe }: { recipe: TRecipe<TModel> }) => {
      const newModel = produce(model, (draft: Draft<TModel>) => {
        recipe({ draft });
      });

      if (newModel === model) {
        return;
      }

      model = newModel;
      onUpdate();
    }
  };
};

type TModelStore<TModel extends object> = ReturnType<typeof createModelStore<TModel>>;

export {
  createModelStore
};

export type {
  TModelStore,
  TRecipe
};
