import { createApplicationJrpc, requestErrors } from "../ksock/application.ts";
import type { TCreateKsockApplication, TKsockApplication } from "../ksock/endpoint.ts";
import type { TPatchOperation } from "../model-sync/patch.ts";
import type { TLampLogicBackend } from "./logic.ts";
import { lampProtocol } from "./protocol.ts";

type TLampClientApplication = TKsockApplication & {
  // the backend as the logic of the page uses it
  backend: TLampLogicBackend;
};

/*
 * A client of the lamp demo on a ksock endpoint: it takes the patches of the backend model in, and sends switch
 * requests and die rolls to the server.
 */
const createLampClientApplication = ({
  onReady,
  onModelPatch,
  onClosed
}: {
  onReady: () => void,
  onModelPatch: (args: { patch: TPatchOperation[] }) => void,
  onClosed: () => void
}): TCreateKsockApplication<TLampClientApplication> => {
  return ({ send }) => {
    const application = createApplicationJrpc({
      send,

      // the protocol and the JSON-RPC of the application need each other
      handleRequest: async (args) => {
        // eslint-disable-next-line no-use-before-define
        return await protocol.handleIncomingRequest(args);
      },

      handleNotification: (args) => {
        // eslint-disable-next-line no-use-before-define
        protocol.handleIncomingNotification(args);
      }
    });

    const protocol = lampProtocol.sideB({
      outgoingNotify: application.notify,
      outgoingRequest: application.request,

      incomingNotifications: {
        notifications: {
          modelPatch: ({ patch }) => {
            onModelPatch({ patch });
          }
        },
        handleUnknownNotification: () => {},
        handleParametersParseError: () => {}
      },

      incomingRequests: {
        requests: {},
        ...requestErrors
      }
    });

    return {
      ready: onReady,

      received: ({ data }) => {
        application.received({ data });
      },

      writable: () => {},

      closed: () => {
        application.close();
        onClosed();
      },

      backend: {
        switchLamp: (params) => {
          protocol.outgoingNotifications.switchLamp(params);
        },

        rollDie: async () => {
          const { error, result } = await protocol.outgoingRequests.rollDie();
          return error === undefined ? result : undefined;
        }
      }
    };
  };
};

export {
  createLampClientApplication
};
