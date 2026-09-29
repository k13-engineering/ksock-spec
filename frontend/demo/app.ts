import { createDemoLogic, type TDemoLogic } from "../../lib/demo/logic.ts";
import { createDemoViewModel } from "../../lib/demo/view-model.ts";
import { createBrowserTextSocket } from "../browser/text-socket.ts";
import { createDemoDomView } from "./dom-view.ts";

/*
 * The live demo with its logic, its view model and its view, connected to the socket of the server at the url.
 */
const createDemoApp = ({ container, socketUrl }: { container: HTMLElement, socketUrl: string }) => {
  const view = createDemoDomView({ container });

  // recalculates the view model from the current model of the logic and hands it to the view
  const updateView = ({ logic }: { logic: TDemoLogic }) => {
    view.update({ viewModel: createDemoViewModel({ model: logic.model(), logic }) });
  };

  const logic = createDemoLogic({
    socket: createBrowserTextSocket({
      url: socketUrl,

      onOpen: () => {
        logic.connected();
      },

      onText: ({ text }) => {
        logic.messageFromBackend({ text });
      },

      onClose: () => {
        logic.connectionLost();
      }
    }),

    onUpdate: () => {
      updateView({ logic });
    }
  });

  // the first screen, before any update
  updateView({ logic });

  return {
    logic
  };
};

export {
  createDemoApp
};
