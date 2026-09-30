import jsonPatch from "fast-json-patch";
import type { TPatchOperation } from "./patch.ts";

/*
 * Sends a model to one client as JSON patches (3.2), each the difference between the model sent last, at first an
 * empty object, and the model now. While the connection is not writable, it waits, and then sends the difference to the
 * model as it is then, so changes that come faster than the client takes them merge into one patch.
 */
const createModelSender = <TModel extends object>({
  send,
  writable
}: {
  send: (args: { patch: TPatchOperation[] }) => void,
  writable: () => boolean
}) => {
  let sent: object = {};
  let current: TModel | undefined = undefined;

  const sendDifference = () => {
    if (current === undefined || !writable()) {
      return;
    }

    const patch = jsonPatch.compare(sent, current) as TPatchOperation[];

    if (patch.length > 0) {
      sent = current;
      send({ patch });
    }
  };

  return {
    changed: ({ model }: { model: TModel }) => {
      current = model;
      sendDifference();
    },

    // a grant allows messages again
    writable: sendDifference
  };
};

export {
  createModelSender
};
