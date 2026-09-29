const EConnection = {
  CONNECTING: "CONNECTING",
  OPEN: "OPEN",
  CLOSED: "CLOSED"
} as const;

type EConnection = (typeof EConnection)[keyof typeof EConnection];

const EDirection = {
  SENT: "SENT",
  RECEIVED: "RECEIVED"
} as const;

type EDirection = (typeof EDirection)[keyof typeof EDirection];

type TDemoMessage = {
  direction: EDirection;
  text: string;
};

/*
 * The state of the live demo, a socket to the server of this page, which sends every message back.
 */
type TDemoModel = {
  backend: {
    // how the socket is, as it reported it
    connection: EConnection;
  };

  ui: {
    // the next message, as typed
    messageInput: string;
    // what went over the socket, what this page sent and what came back, oldest first; the server keeps no log
    messages: TDemoMessage[];
  };
};

const initialDemoModel: TDemoModel = {
  backend: {
    connection: EConnection.CONNECTING
  },

  ui: {
    messageInput: "",
    messages: []
  }
};

export {
  EConnection,
  EDirection,
  initialDemoModel
};

export type {
  TDemoMessage,
  TDemoModel
};
