import { Binary } from "bson";
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
} from "./parsers.ts";

// the version of ksock this implements
const ksockVersion = 1;

// the close codes of an endpoint that closes the connection because of the other one (1.6)
const ECloseCode = {
  NORMAL: 1000,
  PROTOCOL_VIOLATION: 4000,
  UNSUPPORTED_VERSION: 4001,
  HEARTBEAT_TIMEOUT: 4002
} as const;

type ECloseCode = (typeof ECloseCode)[keyof typeof ECloseCode];

type THello = { protocol: "ksock", version: number, heartbeatTimeout: number };
type TGrant = { messages: number, bytes: number };
type TMessage = { data: Binary };

const isTimeout = (value: unknown): value is number => {
  return isCount(value) && value > 0;
};

const isHello = (raw: unknown): raw is THello => {
  return isRecord(raw) && raw.protocol === "ksock" && isCount(raw.version) && isTimeout(raw.heartbeatTimeout);
};

const isGrant = (raw: unknown): raw is TGrant => {
  return isRecord(raw) && isCount(raw.messages) && isCount(raw.bytes);
};

const isMessage = (raw: unknown): raw is TMessage => {
  return isRecord(raw) && raw.data instanceof Binary && raw.data.sub_type === Binary.SUBTYPE_DEFAULT;
};

// the notifications of the core (1.1), the same in both directions
const ksockNotifications = createRpcNotificationsDefinition({
  hello: { paramsParser: createParser(isHello) },
  grant: { paramsParser: createParser(isGrant) },
  heartbeat: { paramsParser: noParamsParser },
  message: { paramsParser: createParser(isMessage) }
});

// the client and the server handle the same notifications, and no requests (2.2 of the spec)
const ksockEndpoint = {
  requests: createRpcRequestsDefinition({}),
  notifications: ksockNotifications
};

const ksockProtocol = createCombined({
  sideADefinitions: ksockEndpoint,
  sideBDefinitions: ksockEndpoint
});

export {
  ECloseCode,
  ksockNotifications,
  ksockProtocol,
  ksockVersion
};

export type {
  TGrant,
  THello,
  TMessage
};
