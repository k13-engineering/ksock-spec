import type { TLampBackendModel } from "./protocol.ts";

const EConnection = {
  CONNECTING: "CONNECTING",
  OPEN: "OPEN",
  CLOSED: "CLOSED"
} as const;

type EConnection = (typeof EConnection)[keyof typeof EConnection];

// the state of the lamp demo on the page
type TLampModel = {
  backend: {
    // how the connection to the server is, as the endpoint reported it
    connection: EConnection;
    // the backend model as the patches of the server made it, undefined until the first patch
    model: TLampBackendModel | undefined;
  };

  ui: {
    // the sequence of the last switch request sent, 0 before the first; it is pending while the backend model mirrors a
    // lower one
    switchRequestSequence: number;
    dieRolling: boolean;
    // what the last roll came to, which only this page knows
    dieValue: number | undefined;
  };
};

const initialLampModel: TLampModel = {
  backend: {
    connection: EConnection.CONNECTING,
    model: undefined
  },

  ui: {
    switchRequestSequence: 0,
    dieRolling: false,
    dieValue: undefined
  }
};

export {
  EConnection,
  initialLampModel
};

export type {
  TLampModel
};
