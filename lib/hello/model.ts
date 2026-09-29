/*
 * The state of the hello page. The page has no backend, so its model is the ui part alone: the name the user typed,
 * as typed. Whom the page greets is derived from it in the view model.
 */
type THelloModel = {
  ui: {
    nameInput: string;
  };
};

const initialHelloModel: THelloModel = {
  ui: {
    nameInput: ""
  }
};

export {
  initialHelloModel
};

export type {
  THelloModel
};
