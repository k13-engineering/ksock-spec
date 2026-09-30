import type { TKsockSettings } from "../ksock/endpoint.ts";

// the ksock settings of both ends of the lamp demo: 10 s without a notification is a lost connection
const lampKsockSettings: TKsockSettings = {
  heartbeatTimeout: 10000,
  grant: { messages: 16, bytes: 65536 }
};

export {
  lampKsockSettings
};
