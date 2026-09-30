import { createApplicationJrpc, requestErrors } from "../ksock/application.ts";
import type { TCreateKsockApplication, TKsockApplication } from "../ksock/endpoint.ts";
import { createModelSender } from "../model-sync/sender.ts";
import type { TLampBackend, TLampSession } from "./backend.ts";
import { lampProtocol, type TLampBackendModel } from "./protocol.ts";

/*
 * The server of the lamp demo on a ksock endpoint: once the client said hello, it sends the client the backend model
 * as JSON patches, and hands its requests to the backend.
 */
const createLampServerApplication = ({ backend }: { backend: TLampBackend }): TCreateKsockApplication<TKsockApplication> => {
  return ({ send, writable }) => {
    let session: TLampSession | undefined = undefined;

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

    const protocol = lampProtocol.sideA({
      outgoingNotify: application.notify,
      outgoingRequest: application.request,

      incomingNotifications: {
        notifications: {
          switchLamp: (params) => {
            session?.switchLamp(params);
          }
        },
        handleUnknownNotification: () => {},
        handleParametersParseError: () => {}
      },

      incomingRequests: {
        requests: {
          // requests only come once the session exists, as messages only come after the hello
          rollDie: async () => {
            return await (session as TLampSession).rollDie();
          }
        },
        ...requestErrors
      }
    });

    const modelSender = createModelSender<TLampBackendModel>({
      send: ({ patch }) => {
        protocol.outgoingNotifications.modelPatch({ patch });
      },
      writable
    });

    return {
      ready: () => {
        session = backend.connect({ onModelChanged: modelSender.changed });
        modelSender.changed({ model: session.model() });
      },

      received: ({ data }) => {
        application.received({ data });
      },

      writable: modelSender.writable,

      closed: () => {
        session?.disconnect();
        application.close();
      }
    };
  };
};

export {
  createLampServerApplication
};
