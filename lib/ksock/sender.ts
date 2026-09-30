import { serialize } from "bson";
import type { TNotifyMethod } from "@k13engineering/yajrpc";
import { ksockNotifications, type TGrant } from "./protocol.ts";
import type { TTimers } from "./timers.ts";

type TKsockSocket = {
  send: (args: { bytes: Uint8Array }) => void;
  close: (args: { code: number }) => void;
};

/*
 * What an endpoint sends: the notifications of the core right away, and the message notifications once the credit of
 * the last grant received covers them, in the order they were sent (1.3). A grant sets the credit, it does not add to
 * it.
 */
const createKsockSender = ({ socket, timers }: { socket: TKsockSocket, timers: TTimers }) => {
  let open = true;
  let lastSentAt = timers.now();
  let credit: TGrant = { messages: 0, bytes: 0 };
  let waiting: Uint8Array[] = [];

  const transmit = ({ bytes }: { bytes: Uint8Array }) => {
    socket.send({ bytes });
    lastSentAt = timers.now();
  };

  const covers = ({ bytes }: { bytes: Uint8Array }) => {
    return credit.messages >= 1 && credit.bytes >= bytes.length;
  };

  // whether the next message waiting can go out
  const nextCovered = () => {
    return open && waiting.length > 0 && covers({ bytes: waiting[0] });
  };

  const flush = () => {
    while (nextCovered()) {
      const [bytes, ...rest] = waiting;
      waiting = rest;
      credit = { messages: credit.messages - 1, bytes: credit.bytes - bytes.length };
      transmit({ bytes });
    }
  };

  // a message notification is as large as its BSON document, which is the WebSocket message
  const notify: TNotifyMethod = ({ method, params }) => {
    if (!open) {
      return;
    }

    const bytes = serialize({ jsonrpc: "2.0", method, params });

    if (method === "message") {
      waiting = [...waiting, bytes];
      flush();
      return;
    }

    transmit({ bytes });
  };

  return {
    outgoing: ksockNotifications.createClient({ notify }),

    granted: ({ grant }: { grant: TGrant }) => {
      credit = grant;
      flush();
    },

    // whether a message would go out right away, as far as the count of messages tells
    writable: () => {
      return open && waiting.length === 0 && credit.messages >= 1;
    },

    lastSentAt: () => {
      return lastSentAt;
    },

    stop: () => {
      open = false;
    }
  };
};

type TKsockSender = ReturnType<typeof createKsockSender>;

export {
  createKsockSender
};

export type {
  TKsockSender,
  TKsockSocket
};
