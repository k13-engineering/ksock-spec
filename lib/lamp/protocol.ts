import {
  createCombined,
  createRpcNotificationsDefinition,
  createRpcRequestsDefinition
} from "@k13engineering/yajrpc";
import {
  createParser,
  isCount,
  isRecord,
  noParamsParser
} from "../ksock/parsers.ts";
import { isPatchOperation, type TPatchOperation } from "../model-sync/patch.ts";

// the backend model as one client gets it: the lamp everyone switches, and the last request of this client processed
type TLampBackendModel = {
  lamp: { on: boolean };
  requestSequence: number;
};

type TSwitchLamp = { requestSequence: number, on: boolean };
type TDieRoll = { value: number };
type TModelPatch = { patch: TPatchOperation[] };

const isLampBackendModel = (raw: unknown): raw is TLampBackendModel => {
  return isRecord(raw) && isRecord(raw.lamp) && typeof raw.lamp.on === "boolean" && isCount(raw.requestSequence);
};

const isSwitchLamp = (raw: unknown): raw is TSwitchLamp => {
  return isRecord(raw) && isCount(raw.requestSequence) && typeof raw.on === "boolean";
};

const isDieRoll = (raw: unknown): raw is TDieRoll => {
  return isRecord(raw) && isCount(raw.value);
};

const isModelPatch = (raw: unknown): raw is TModelPatch => {
  return isRecord(raw) && Array.isArray(raw.patch) && raw.patch.every(isPatchOperation);
};

// the protocol of the application in the messages of ksock (3.1)
const lampProtocol = createCombined({
  // the server: switches the lamp for the request of a client (3.3), and rolls a die out of band (3.4)
  sideADefinitions: {
    requests: createRpcRequestsDefinition({
      rollDie: { paramsParser: noParamsParser, resultParser: createParser(isDieRoll) }
    }),
    notifications: createRpcNotificationsDefinition({
      switchLamp: { paramsParser: createParser(isSwitchLamp) }
    })
  },

  // a client: gets the backend model as JSON patches (3.2)
  sideBDefinitions: {
    requests: createRpcRequestsDefinition({}),
    notifications: createRpcNotificationsDefinition({
      modelPatch: { paramsParser: createParser(isModelPatch) }
    })
  }
});

export {
  isLampBackendModel,
  lampProtocol
};

export type {
  TDieRoll,
  TLampBackendModel,
  TModelPatch,
  TSwitchLamp
};
