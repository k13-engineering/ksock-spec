import { createModelStore } from "../model-store.ts";
import { applyPatch, type TPatchOperation } from "../model-sync/patch.ts";
import { EConnection, initialLampModel, type TLampModel } from "./model.ts";
import {
  isLampBackendModel,
  type TDieRoll,
  type TLampBackendModel,
  type TSwitchLamp
} from "./protocol.ts";

// the server, as far as the logic uses it
type TLampLogicBackend = {
  switchLamp: (args: TSwitchLamp) => void;
  // undefined if the roll failed, e.g. as the connection closed
  rollDie: () => Promise<TDieRoll | undefined>;
};

type TLampLogic = {
  // the current model, pulled, never pushed
  model: () => TLampModel;

  requestSwitch: () => void;
  requestRoll: () => Promise<void>;

  // what the connection reports
  connected: () => void;
  connectionLost: () => void;
  modelPatchFromBackend: (args: { patch: TPatchOperation[] }) => void;
};

// the switch request sent last is pending until the backend model mirrors its sequence (3.3)
const switchPending = ({ backendModel, switchRequestSequence }: {
  backendModel: TLampBackendModel,
  switchRequestSequence: number
}) => {
  return backendModel.requestSequence < switchRequestSequence;
};

// a switch needs the backend model to switch, and has one request pending at a time
const canSwitch = ({ connection, backendModel, switchRequestSequence }: {
  connection: EConnection,
  backendModel: TLampBackendModel | undefined,
  switchRequestSequence: number
}) => {
  return connection === EConnection.OPEN && backendModel !== undefined &&
    !switchPending({ backendModel, switchRequestSequence });
};

const createLampLogic = ({ backend, onUpdate }: { backend: TLampLogicBackend, onUpdate: () => void }): TLampLogic => {
  const store = createModelStore<TLampModel>({ initial: initialLampModel, onUpdate });

  const setConnection = ({ connection }: { connection: EConnection }) => {
    store.update({
      recipe: ({ draft }) => {
        // eslint-disable-next-line immutable/no-mutation
        draft.backend.connection = connection;
      }
    });
  };

  const rolled = ({ roll }: { roll: TDieRoll | undefined }) => {
    store.update({
      recipe: ({ draft }) => {
        // eslint-disable-next-line immutable/no-mutation
        draft.ui.dieRolling = false;
        // eslint-disable-next-line immutable/no-mutation
        draft.ui.dieValue = roll?.value ?? draft.ui.dieValue;
      }
    });
  };

  return {
    model: store.model,

    // the sequence of the request is the one the backend model mirrors, plus one
    requestSwitch: () => {
      const { backend: { connection, model: backendModel }, ui: { switchRequestSequence } } = store.model();

      if (backendModel === undefined || !canSwitch({ connection, backendModel, switchRequestSequence })) {
        return;
      }

      const requestSequence = backendModel.requestSequence + 1;
      backend.switchLamp({ requestSequence, on: !backendModel.lamp.on });

      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.switchRequestSequence = requestSequence;
        }
      });
    },

    // out of band: the result comes in the response, not through the backend model (3.4)
    requestRoll: async () => {
      const { backend: { connection }, ui: { dieRolling } } = store.model();

      if (connection !== EConnection.OPEN || dieRolling) {
        return;
      }

      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.dieRolling = true;
        }
      });

      rolled({ roll: await backend.rollDie() });
    },

    connected: () => {
      setConnection({ connection: EConnection.OPEN });
    },

    connectionLost: () => {
      setConnection({ connection: EConnection.CLOSED });
    },

    // the backend part of the model is what the patches make of it, and nothing else
    modelPatchFromBackend: ({ patch }) => {
      const patched = applyPatch({ document: store.model().backend.model ?? {}, patch });

      if (!isLampBackendModel(patched)) {
        return;
      }

      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.backend.model = patched;
        }
      });
    }
  };
};

export {
  canSwitch,
  createLampLogic,
  switchPending
};

export type {
  TLampLogic,
  TLampLogicBackend
};
