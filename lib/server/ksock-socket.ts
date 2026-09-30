import type { WebSocket } from "ws";
import {
  createKsockEndpoint,
  ERole,
  type TCreateKsockApplication,
  type TKsockApplication,
  type TKsockSettings
} from "../ksock/endpoint.ts";
import type { TTimers } from "../ksock/timers.ts";

// the server end of a ksock connection on a WebSocket of ws, with the application on top of it
const serveKsockSocket = ({
  webSocket,
  settings,
  timers,
  application
}: {
  webSocket: WebSocket,
  settings: TKsockSettings,
  timers: TTimers,
  application: TCreateKsockApplication<TKsockApplication>
}) => {
  const endpoint = createKsockEndpoint({
    role: ERole.SERVER,
    socket: {
      send: ({ bytes }) => {
        webSocket.send(bytes);
      },
      close: ({ code }) => {
        webSocket.close(code);
      }
    },
    settings,
    timers,
    application
  });

  // ws dictates the positional parameters of its event listeners, and hands binary messages over as one buffer
  // eslint-disable-next-line k13-engineering/prefer-single-object-parameters
  webSocket.on("message", (data, isBinary) => {
    if (isBinary) {
      endpoint.received({ bytes: data as Uint8Array });
    } else {
      endpoint.receivedText();
    }
  });

  webSocket.on("close", (code) => {
    endpoint.socketClosed({ code });
  });

  endpoint.opened();
};

export {
  serveKsockSocket
};
