/*
 * The field is an input element of the dom, whose value is assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type { TInputViewModel } from "../view-model.ts";

/*
 * A native text field that shows the value of its view model and nothing else. Every edit goes out through onInput,
 * and the field then shows the value of the view model the edit led to, so an edit the logic rejects is undone. The
 * caret, the selection and the focus stay with the input element.
 */
const createInputDomView = ({ container }: { container: HTMLElement }) => {
  const input = document.createElement("input");
  input.type = "text";
  container.append(input);

  let shown: TInputViewModel | undefined = undefined;

  const showValue = () => {
    // assigning the value the field has already would move the caret to the end
    if (shown !== undefined && input.value !== shown.value) {
      input.value = shown.value;
    }
  };

  const onInput = () => {
    shown?.onInput({ value: input.value });
    showValue();
  };

  input.addEventListener("input", onInput);

  return {
    update: ({ viewModel }: { viewModel: TInputViewModel }) => {
      shown = viewModel;
      showValue();
    },

    destroy: () => {
      input.removeEventListener("input", onInput);
      input.remove();
    }
  };
};

export {
  createInputDomView
};
