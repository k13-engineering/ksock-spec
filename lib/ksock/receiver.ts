import { createJrpc } from "@k13engineering/yajrpc";
import { documentOf } from "./documents.ts";
import type { TKsockHeartbeats } from "./heartbeats.ts";
import {
  ECloseCode,
  ksockNotifications,
  ksockVersion,
  type TGrant,
  type THello,
  type TMessage
} from "./protocol.ts";
import type { TKsockSender } from "./sender.ts";

const ERole = {
  // opens the WebSocket, says hello first
  CLIENT: "CLIENT",
  // accepts the WebSocket, answers a valid hello
  SERVER: "SERVER"
} as const;

type ERole = (typeof ERole)[keyof typeof ERole];

type TKsockSettings = {
  // the longest time the endpoint waits for a notification of the other endpoint
  heartbeatTimeout: number;
  // what the endpoint grants the other endpoint each time
  grant: TGrant;
};

// what an application on top of the core does with the connection
type TKsockApplication = {
  // the hellos are exchanged, messages go out as soon as a grant allows them
  ready: () => void;
  received: (args: { data: Uint8Array }) => void;
  // a grant arrived, and a message would go out right away
  writable: () => void;
  // the code the connection closed with, undefined if the socket did not tell
  closed: (args: { code: number | undefined }) => void;
};

// grants again once the messages received used up half of the last grant, in messages or in bytes (1.3)
const createGranting = ({ grant, sendGrant }: { grant: TGrant, sendGrant: (grant: TGrant) => void }) => {
  let used: TGrant = { messages: 0, bytes: 0 };

  return {
    first: () => {
      sendGrant(grant);
    },

    received: ({ size }: { size: number }) => {
      used = { messages: used.messages + 1, bytes: used.bytes + size };

      if (used.messages * 2 >= grant.messages || used.bytes * 2 >= grant.bytes) {
        used = { messages: 0, bytes: 0 };
        sendGrant(grant);
      }
    }
  };
};

/*
 * What an endpoint receives: one BSON document per WebSocket message, each a notification of the core, the first of
 * them the hello of the other endpoint (1.1, 1.2). Anything else closes the connection as a protocol violation.
 */
const createKsockReceiver = ({
  role,
  settings,
  sender,
  heartbeats,
  application,
  close
}: {
  role: ERole,
  settings: TKsockSettings,
  sender: TKsockSender,
  heartbeats: TKsockHeartbeats,
  application: TKsockApplication,
  close: (args: { code: ECloseCode }) => void
}) => {
  let peerHello: THello | undefined = undefined;
  let receivedSize = 0;

  const granting = createGranting({ grant: settings.grant, sendGrant: sender.outgoing.grant });

  const sayHello = () => {
    sender.outgoing.hello({ protocol: "ksock", version: ksockVersion, heartbeatTimeout: settings.heartbeatTimeout });
    granting.first();
  };

  const violation = () => {
    close({ code: ECloseCode.PROTOCOL_VIOLATION });
  };

  const helloReceived = (hello: THello) => {
    if (peerHello !== undefined) {
      violation();
      return;
    }

    if (hello.version !== ksockVersion) {
      close({ code: ECloseCode.UNSUPPORTED_VERSION });
      return;
    }

    peerHello = hello;

    if (role === ERole.SERVER) {
      sayHello();
    }

    heartbeats.peerTimeoutKnown({ peerTimeout: hello.heartbeatTimeout });
    application.ready();
  };

  // every notification but the hello needs the hello first
  const afterHello = <TParams>({ handle }: { handle: (params: TParams) => void }) => {
    return (params: TParams) => {
      if (peerHello === undefined) {
        violation();
        return;
      }

      handle(params);
    };
  };

  const incoming = ksockNotifications.createServer({
    notifications: {
      hello: helloReceived,

      grant: afterHello({
        handle: (grant: TGrant) => {
          sender.granted({ grant });

          if (sender.writable()) {
            application.writable();
          }
        }
      }),

      heartbeat: afterHello({ handle: () => {} }),

      message: afterHello({
        handle: ({ data }: TMessage) => {
          application.received({ data: data.value() });
          granting.received({ size: receivedSize });
        }
      })
    },

    handleUnknownNotification: violation,
    handleParametersParseError: violation
  });

  const coreJrpc = createJrpc({
    // only to answer requests, which the core has none of, so it is never called
    /* c8 ignore next */
    sendMessage: () => {},

    handleRequest: async () => {
      violation();
      return { result: undefined, error: undefined };
    },

    handleNotification: incoming.handleNotification
  });

  return {
    sayHello,

    received: ({ bytes }: { bytes: Uint8Array }) => {
      const document = documentOf({ bytes });
      receivedSize = bytes.length;

      const { error } = document === undefined
        ? { error: Error("not one BSON document") }
        : coreJrpc.receivedMessage({ message: document });

      if (error !== undefined) {
        violation();
      }
    }
  };
};

export {
  createKsockReceiver,
  ERole
};

export type {
  TKsockApplication,
  TKsockSettings
};
