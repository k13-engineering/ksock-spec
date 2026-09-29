// a text field, controlled by its view model
type TInputViewModel = {
  value: string;
  // the whole new value, not a key
  onInput: (args: { value: string }) => void;
};

export type {
  TInputViewModel
};
