import { serialize } from "bson";
import {
  createJrpc,
  type TNotificationHandler,
  type TRequestHandler
} from "@k13engineering/yajrpc";
import { documentOf } from "./documents.ts";

// the answers to requests an application does not know or cannot read
const requestErrors = {
  handleUnknownRequest: async () => {
    return { error: { code: -32601, message: "Method not found" }, result: undefined };
  },

  handleParametersParseError: async () => {
    return { error: { code: -32602, message: "Invalid params" }, result: undefined };
  }
};

/*
 * The JSON-RPC 2.0 of an application in the message notifications of ksock, one BSON document in the data of each
 * (3.1): requests, responses and notifications, as the core carries them.
 */
const createApplicationJrpc = ({
  send,
  handleRequest,
  handleNotification
}: {
  send: (args: { data: Uint8Array }) => void,
  handleRequest: TRequestHandler,
  handleNotification: TNotificationHandler
}) => {
  let closed = false;

  const jrpc = createJrpc({
    sendMessage: ({ message }) => {
      send({ data: serialize(message) });
    },
    handleRequest,
    handleNotification
  });

  return {
    // an error if the data is not a JSON-RPC message in a BSON document, or the connection closed
    received: ({ data }: { data: Uint8Array }): { error: Error | undefined } => {
      const document = documentOf({ bytes: data });

      if (closed || document === undefined) {
        return { error: Error("not a message of the application") };
      }

      return jrpc.receivedMessage({ message: document });
    },

    request: jrpc.request,
    notify: jrpc.notify,

    // answers the requests still pending with an error
    close: () => {
      if (!closed) {
        closed = true;
        jrpc.close();
      }
    }
  };
};

export {
  createApplicationJrpc,
  requestErrors
};
