type TButtonViewModel = {
  label: string;
  enabled: boolean;
  // shows a spinner, while what the button triggered is under way
  busy: boolean;
  onClicked: (args: { event: Event }) => void;
};

export type {
  TButtonViewModel
};
