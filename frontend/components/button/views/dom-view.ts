/*
 * The button is an element of the dom, whose properties are assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type { TButtonViewModel } from "../view-model.ts";

/*
 * A native button with a fixed label. It has no type, so in a form it is the button that submits it, and the browser
 * clicks it for Enter in a field of the form.
 */
const createButtonDomView = ({ container, label }: { container: HTMLElement, label: string }) => {
  const button = document.createElement("button");
  button.textContent = label;
  container.append(button);

  let shown: TButtonViewModel | undefined = undefined;

  const onClick = (event: Event) => {
    shown?.onClicked({ event });
  };

  button.addEventListener("click", onClick);

  return {
    update: ({ viewModel }: { viewModel: TButtonViewModel }) => {
      shown = viewModel;
      button.disabled = !viewModel.enabled;
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
