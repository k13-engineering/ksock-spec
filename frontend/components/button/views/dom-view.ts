/*
 * The button is an element of the dom, whose properties are assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type { TButtonViewModel } from "../view-model.ts";

/*
 * A native button with the label of its view model, and a spinner while it is busy. Its look, the spinner turning
 * included, is up to the page, by the classes button, button-spinner and button-label and aria-busy.
 */
const createButtonDomView = ({ container }: { container: HTMLElement }) => {
  const spinner = document.createElement("span");
  spinner.className = "button-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "button-label";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button";
  button.append(spinner, label);
  container.append(button);

  let shown: TButtonViewModel | undefined = undefined;

  const onClick = (event: Event) => {
    shown?.onClicked({ event });
  };

  button.addEventListener("click", onClick);

  return {
    update: ({ viewModel }: { viewModel: TButtonViewModel }) => {
      shown = viewModel;
      label.textContent = viewModel.label;
      button.disabled = !viewModel.enabled;
      button.setAttribute("aria-busy", `${viewModel.busy}`);
    },

    destroy: () => {
      button.removeEventListener("click", onClick);
      button.remove();
    }
  };
};

export {
  createButtonDomView
};
