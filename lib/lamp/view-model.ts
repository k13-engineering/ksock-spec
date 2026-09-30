import { memoize } from "proxy-memoize";
import type { TButtonViewModel } from "../../frontend/components/button/view-model.ts";
import { canSwitch, switchPending, type TLampLogic } from "./logic.ts";
import type { EConnection, TLampModel } from "./model.ts";
import type { TLampBackendModel } from "./protocol.ts";

type TStatusViewModel = {
  text: string;
  // a css color
  color: string;
};

type TLampSectionViewModel = {
  text: string;
  // the css color of the bulb
  color: string;
  buttonSwitch: TButtonViewModel;
  // what became of the switch requests, by their sequence
  note: string;
};

type TDieViewModel = {
  buttonRoll: TButtonViewModel;
  resultText: string;
};

type TLampViewModel = {
  status: TStatusViewModel;
  // the backend model as this page has it, as text
  modelText: string;
  // undefined until the backend model arrived
  lamp: TLampSectionViewModel | undefined;
  die: TDieViewModel;
};

// how the lamp looks, and what its button does, while it is on and while it is off
const looks = {
  on: { text: "The lamp is on.", color: "#f5c542", label: "Switch off" },
  off: { text: "The lamp is off.", color: "#c8c8c2", label: "Switch on" }
};

const statuses: { [connection in EConnection]: TStatusViewModel } = {
  CONNECTING: { text: "connecting…", color: "#c98a0b" },
  OPEN: { text: "connected", color: "#1f8a3b" },
  CLOSED: { text: "disconnected, reload the page to connect again", color: "#b3261e" }
};

const modelTextOf = memoize(({ backendModel }: { backendModel: TLampBackendModel | undefined }) => {
  return backendModel === undefined ? "waiting for the first patch…" : JSON.stringify(backendModel, undefined, 2);
});

const noteOf = ({ backendModel, switchRequestSequence }: {
  backendModel: TLampBackendModel,
  switchRequestSequence: number
}) => {
  if (switchPending({ backendModel, switchRequestSequence })) {
    return `Request ${switchRequestSequence} sent. The button spins until the backend model mirrors its sequence.`;
  }

  if (backendModel.requestSequence === 0) {
    return "No request yet. The backend model mirrors the sequence 0.";
  }

  return `Request ${backendModel.requestSequence} done: the backend model mirrors its sequence, and shows its result.`;
};

const createLampSectionViewModel = memoize(({ connection, backendModel, switchRequestSequence, logic }: {
  connection: EConnection,
  backendModel: TLampBackendModel | undefined,
  switchRequestSequence: number,
  logic: TLampLogic
}): TLampSectionViewModel | undefined => {
  if (backendModel === undefined) {
    return undefined;
  }

  const { text, color, label } = backendModel.lamp.on ? looks.on : looks.off;

  return {
    text,
    color,

    buttonSwitch: {
      label,
      enabled: canSwitch({ connection, backendModel, switchRequestSequence }),
      busy: switchPending({ backendModel, switchRequestSequence }),
      onClicked: () => {
        logic.requestSwitch();
      }
    },

    note: noteOf({ backendModel, switchRequestSequence })
  };
});

const createDieViewModel = memoize(({ connection, dieRolling, dieValue, logic }: {
  connection: EConnection,
  dieRolling: boolean,
  dieValue: number | undefined,
  logic: TLampLogic
}): TDieViewModel => {
  return {
    buttonRoll: {
      label: "Roll the die",
      enabled: connection === "OPEN" && !dieRolling,
      busy: dieRolling,
      onClicked: () => {
        void logic.requestRoll();
      }
    },

    resultText: dieValue === undefined
      ? "Not rolled yet."
      : `You rolled a ${dieValue}. Only this page got it, in the response to its request. The backend model does not know it.`
  };
});

const createLampViewModel = memoize(({ model, logic }: { model: TLampModel, logic: TLampLogic }): TLampViewModel => {
  const { backend: { connection, model: backendModel }, ui } = model;

  return {
    status: { ...statuses[connection] },
    modelText: modelTextOf({ backendModel }),
    lamp: createLampSectionViewModel({ connection, backendModel, switchRequestSequence: ui.switchRequestSequence, logic }),
    die: createDieViewModel({ connection, dieRolling: ui.dieRolling, dieValue: ui.dieValue, logic })
  };
});

export {
  createLampViewModel
};

export type {
  TDieViewModel,
  TLampSectionViewModel,
  TLampViewModel
};
