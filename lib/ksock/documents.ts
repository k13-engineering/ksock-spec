import { deserialize, type Document } from "bson";

// the BSON document of a WebSocket message, undefined if the message is not exactly one BSON document
const documentOf = ({ bytes }: { bytes: Uint8Array }): Document | undefined => {
  try {
    return deserialize(bytes);
  } catch {
    return undefined;
  }
};

export {
  documentOf
};
