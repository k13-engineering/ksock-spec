import { Binary } from "bson";
import { createKsockHeartbeats } from "./heartbeats.ts";
import { ECloseCode } from "./protocol.ts";
import {
  createKsockReceiver,
  ERole,
  type TKsockApplication,
  type TKsockSettings
} from "./receiver.ts";
import { createKsockSender, type TKsockSocket } from "./sender.ts";
import type { TTimers } from "./timers.ts";

// an application on top of the core, created with the ways it has to send
type TCreateKsockApplication<TApplication extends TKsockApplication> = (args: {
  send: (args: { data: Uint8Array }) => void,
  writable: () => boolean
}) => TApplication;

/*
 * One end of a ksock connection over a WebSocket, which the socket passed in stands for: the core of the spec, for the
 * client or the server. What arrives on the socket goes into opened, received, receivedText and socketClosed, the
 * messages of the application go out through its send.
 */
const createKsockEndpoint = <TApplication extends TKsockApplication>({
  role,
  socket,
  settings,
  timers,
  application: createApplication
}: {
  role: ERole,
  socket: TKsockSocket,
  settings: TKsockSettings,
  timers: TTimers,
  application: TCreateKsockApplication<TApplication>
}) => {
  let closed = false;

  const sender = createKsockSender({ socket, timers });

  const application = createApplication({
    send: ({ data }) => {
      // bson has no factory for its binary data
      // eslint-disable-next-line k13-engineering/no-new
      sender.outgoing.message({ data: new Binary(data) });
    },
    writable: sender.writable
  });

  // closes the connection once, with the timers of the heartbeats already stopped
  const shut = ({ code }: { code: ECloseCode }) => {
    if (closed) {
      return;
    }

    closed = true;
    sender.stop();
    socket.close({ code });
    application.closed({ code });
  };

  const heartbeats = createKsockHeartbeats({
    timers,
    heartbeatTimeout: settings.heartbeatTimeout,
    lastSentAt: sender.lastSentAt,
    sendHeartbeat: sender.outgoing.heartbeat,
    timedOut: () => {
      shut({ code: ECloseCode.HEARTBEAT_TIMEOUT });
    }
  });

  const close = ({ code }: { code: ECloseCode }) => {
    heartbeats.stop();
    shut({ code });
  };

  const receiver = createKsockReceiver({ role, settings, sender, heartbeats, application, close });

  return {
    // the WebSocket is open: the client says hello first, the server waits for it (1.2)
    opened: () => {
      heartbeats.start();

      if (role === ERole.CLIENT) {
        receiver.sayHello();
      }
    },

    received: ({ bytes }: { bytes: Uint8Array }) => {
      if (!closed) {
        heartbeats.received();
        receiver.received({ bytes });
      }
    },

    // text messages are not part of ksock (1.1)
    receivedText: () => {
      close({ code: ECloseCode.PROTOCOL_VIOLATION });
    },

    socketClosed: ({ code }: { code: number | undefined }) => {
      if (!closed) {
        closed = true;
        heartbeats.stop();
        sender.stop();
        application.closed({ code });
      }
    },

    close: () => {
      close({ code: ECloseCode.NORMAL });
    },

    application
  };
};

type TKsockEndpoint<TApplication extends TKsockApplication> = ReturnType<typeof createKsockEndpoint<TApplication>>;

export {
  createKsockEndpoint,
  ERole
};

export type {
  TCreateKsockApplication,
  TKsockApplication,
  TKsockEndpoint,
  TKsockSettings,
  TKsockSocket
};
