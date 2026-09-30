// a client and a server endpoint connected in memory, with fake timers, for the tests of the core
import {
  Binary,
  deserialize,
  serialize,
  type Document
} from "bson";
import { createKsockEndpoint, ERole, type TKsockSettings } from "./endpoint.ts";
import { createFakeTimers } from "./fake-timers.ts";
import type { TTimers } from "./timers.ts";

// what a notification was, in short, e.g. "grant 16 65536"
const summaryOf = ({ document }: { document: Document }) => {
  const params = Object.values(document.params ?? {}).map((value) => {
    return value instanceof Binary ? new TextDecoder().decode(value.value()) : `${value}`;
  });

  return [document.method, ...params].join(" ");
};

// a socket of one end, which holds what is sent until the test delivers it
const createTestSocket = () => {
  let outbox: Uint8Array[] = [];
  let sent: string[] = [];
  let closeCode: number | undefined = undefined;

  return {
    socket: {
      send: ({ bytes }: { bytes: Uint8Array }) => {
        outbox = [...outbox, bytes];
        sent = [...sent, summaryOf({ document: deserialize(bytes) })];
      },

      close: ({ code }: { code: number }) => {
        closeCode = code;
      }
    },

    take: () => {
      const taken = outbox;
      outbox = [];
      return taken;
    },

    sent: () => {
      return sent;
    },

    closeCode: () => {
      return closeCode;
    }
  };
};

// an application that records what happens to it, and sends text
const createTestApplication = ({ send, writable }: { send: (args: { data: Uint8Array }) => void, writable: () => boolean }) => {
  let events: string[] = [];

  const record = ({ event }: { event: string }) => {
    events = [...events, event];
  };

  return {
    ready: () => {
      record({ event: "ready" });
    },

    received: ({ data }: { data: Uint8Array }) => {
      record({ event: `received ${new TextDecoder().decode(data)}` });
    },

    writable: () => {
      record({ event: "writable" });
    },

    closed: ({ code }: { code: number | undefined }) => {
      record({ event: `closed ${code}` });
    },

    sendText: ({ text }: { text: string }) => {
      send({ data: new TextEncoder().encode(text) });
    },

    canSend: writable,

    events: () => {
      return events;
    }
  };
};

const defaultSettings: TKsockSettings = { heartbeatTimeout: 1000, grant: { messages: 16, bytes: 65536 } };

const createTestEnd = ({ role, settings, timers }: { role: ERole, settings: TKsockSettings, timers: TTimers }) => {
  const testSocket = createTestSocket();
  const endpoint = createKsockEndpoint({ role, socket: testSocket.socket, settings, timers, application: createTestApplication });

  return {
    ...testSocket,
    endpoint,
    app: endpoint.application
  };
};

// delivers what both ends sent, until neither sends anything more
const pumpBetween = ({ client, server }: { client: ReturnType<typeof createTestEnd>, server: ReturnType<typeof createTestEnd> }) => {
  for (let batches = [client.take(), server.take()]; batches.some((batch) => {
    return batch.length > 0;
  }); batches = [client.take(), server.take()]) {
    batches[0].forEach((bytes) => {
      server.endpoint.received({ bytes });
    });
    batches[1].forEach((bytes) => {
      client.endpoint.received({ bytes });
    });
  }
};

const createTestConnection = ({
  client: clientSettings = defaultSettings,
  server: serverSettings = defaultSettings
}: {
  client?: TKsockSettings,
  server?: TKsockSettings
} = {}) => {
  const { timers, advance } = createFakeTimers();
  const client = createTestEnd({ role: ERole.CLIENT, settings: clientSettings, timers });
  const server = createTestEnd({ role: ERole.SERVER, settings: serverSettings, timers });

  const pump = () => {
    pumpBetween({ client, server });
  };

  return {
    client,
    server,
    pump,

    // lets time pass with the network delivering right away, or not at all
    advance: ({ ms, deliver = true }: { ms: number, deliver?: boolean }) => {
      advance({ ms, afterEach: deliver ? pump : () => {} });
    },

    // opens the WebSocket at both ends and lets the hellos and the first grants pass
    open: () => {
      client.endpoint.opened();
      server.endpoint.opened();
      pump();
    }
  };
};

// the bytes of a notification as another endpoint could send them
const bytesOf = ({ document }: { document: Document }) => {
  return serialize({ jsonrpc: "2.0", ...document });
};

export {
  bytesOf,
  createTestConnection,
  defaultSettings
};
