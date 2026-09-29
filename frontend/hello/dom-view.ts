/*
 * The page is built with the dom, whose properties are assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type { THelloPageViewModel } from "../../lib/hello/view-model.ts";
import { createInputDomView } from "../components/input/views/dom-view.ts";

const style = `
.hello {
  max-width: 640px;
  margin: 0 auto;
  padding: 56px 24px;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  color: #1d1d1b;
}

.hello h1 {
  margin: 0 0 24px;
  font-size: 32px;
}

.hello label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.hello input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #c8c8c2;
  border-radius: 6px;
  font: inherit;
  font-weight: normal;
}
`;

// the fixed markup of the page, what shows in it comes from the view model
const markup = `
<h1 class="greeting"></h1>
<label class="name">Name</label>
`;

/*
 * The hello page in plain html. The view model is memoized, so an identical view model means nothing changed and the
 * page is left as it is.
 */
const createHelloDomView = ({ container }: { container: HTMLElement }) => {
  const styleElement = document.createElement("style");
  styleElement.textContent = style;
  document.head.append(styleElement);

  const page = document.createElement("main");
  page.className = "hello";
  page.innerHTML = markup;
  container.append(page);

  const greeting = page.querySelector(".greeting") as HTMLElement;
  const nameInput = createInputDomView({ container: page.querySelector(".name") as HTMLElement });

  let shown: THelloPageViewModel | undefined = undefined;

  return {
    update: ({ viewModel }: { viewModel: THelloPageViewModel }) => {
      if (viewModel === shown) {
        return;
      }

      shown = viewModel;
      greeting.textContent = viewModel.greeting;
      nameInput.update({ viewModel: viewModel.nameInput });
    },

    destroy: () => {
      nameInput.destroy();
      page.remove();
      styleElement.remove();
    }
  };
};

export {
  createHelloDomView
};
