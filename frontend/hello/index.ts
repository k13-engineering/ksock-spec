import { createHelloLogic, type THelloLogic } from "../../lib/hello/logic.ts";
import { createHelloPageViewModel } from "../../lib/hello/view-model.ts";
import { createHelloDomView } from "./dom-view.ts";

const view = createHelloDomView({ container: document.querySelector("#app") as HTMLElement });

// recalculates the view model from the current model of the logic and hands it to the view
const updateView = ({ logic }: { logic: THelloLogic }) => {
  view.update({ viewModel: createHelloPageViewModel({ model: logic.model(), logic }) });
};

const logic = createHelloLogic({
  onUpdate: () => {
    updateView({ logic });
  }
});

// the first screen, before any update
updateView({ logic });
