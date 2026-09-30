/*
 * The browser WebSocket constructor is not on the no-new allow list, and there is no factory form of it. It hands
 * binary messages over as Blobs unless its binaryType is assigned, which the immutable/no-mutation rule forbids.
 */
/* eslint-disable k13-engineering/no-new, immutable/no-mutation */
import {
  createKsockEndpoint,
  ERole,
  type TCreateKsockApplication,
  type TKsockApplication,
  type TKsockSettings
} from "../../lib/ksock/endpoint.ts";
import { systemTimers } from "../../lib/ksock/timers.ts";

// the client end of a ksock connection on a WebSocket of the browser, with the application on top of it
const openKsockSocket = <TApplication extends TKsockApplication>({
  url,
  settings,
  application
}: {
  url: string,
  settings: TKsockSettings,
  application: TCreateKsockApplication<TApplication>
}) => {
  const webSocket = new WebSocket(url);
  webSocket.binaryType = "arraybuffer";

  const endpoint = createKsockEndpoint({
    role: ERole.CLIENT,
    socket: {
      // the bytes bson serializes to have an ArrayBuffer of their own
      send: ({ bytes }) => {
        webSocket.send(bytes as Uint8Array<ArrayBuffer>);
      },
      close: ({ code }) => {
        webSocket.close(code);
      }
    },
    settings,
    timers: systemTimers,
    application
  });

  webSocket.addEventListener("open", () => {
    endpoint.opened();
  });

  webSocket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      endpoint.receivedText();
    } else {
      endpoint.received({ bytes: new Uint8Array(event.data) });
    }
  });

  // also after an error, which a close always follows
  webSocket.addEventListener("close", (event) => {
    endpoint.socketClosed({ code: event.code });
  });

  return endpoint;
};

export {
  openKsockSocket
};
