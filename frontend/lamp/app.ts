import { createLampClientApplication } from "../../lib/lamp/client.ts";
import { createLampLogic, type TLampLogic } from "../../lib/lamp/logic.ts";
import { lampKsockSettings } from "../../lib/lamp/settings.ts";
import { createLampViewModel } from "../../lib/lamp/view-model.ts";
import { openKsockSocket } from "../browser/ksock-socket.ts";
import { createLampDomView } from "./dom-view.ts";

/*
 * The lamp demo with its logic, its view model and its view, connected to the server over ksock at the url.
 */
const createLampApp = ({ container, socketUrl }: { container: HTMLElement, socketUrl: string }) => {
  const view = createLampDomView({ container });

  // recalculates the view model from the current model of the logic and hands it to the view
  const updateView = ({ logic }: { logic: TLampLogic }) => {
    view.update({ viewModel: createLampViewModel({ model: logic.model(), logic }) });
  };

  const logic = createLampLogic({
    backend: openKsockSocket({
      url: socketUrl,
      settings: lampKsockSettings,
      application: createLampClientApplication({
        onReady: () => {
          logic.connected();
        },
        onModelPatch: ({ patch }) => {
          logic.modelPatchFromBackend({ patch });
        },
        onClosed: () => {
          logic.connectionLost();
        }
      })
    }).application.backend,

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
  createLampApp
};
