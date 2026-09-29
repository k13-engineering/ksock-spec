import { createModelStore } from "../model-store.ts";
import { EConnection, EDirection, initialDemoModel, type TDemoModel } from "./model.ts";

// the socket to the server, as far as the logic uses it
type TDemoSocket = {
  send: (args: { text: string }) => void;
};

type TDemoLogic = {
  // the current model, pulled, never pushed
  model: () => TDemoModel;

  requestMessageChange: (args: { value: string }) => void;
  requestSend: () => void;

  // what the socket reports
  connected: () => void;
  connectionLost: () => void;
  messageFromBackend: (args: { text: string }) => void;
};

// a message can only go out over an open socket, and an empty one would show nothing
const canSend = ({ connection, messageInput }: { connection: EConnection, messageInput: string }) => {
  return connection === EConnection.OPEN && messageInput !== "";
};

const createDemoLogic = ({ socket, onUpdate }: { socket: TDemoSocket, onUpdate: () => void }): TDemoLogic => {
  const store = createModelStore<TDemoModel>({ initial: initialDemoModel, onUpdate });

  const withMessage = ({ direction, text }: { direction: EDirection, text: string }) => {
    return [...store.model().ui.messages, { direction, text }];
  };

  const setConnection = ({ connection }: { connection: EConnection }) => {
    store.update({
      recipe: ({ draft }) => {
        // eslint-disable-next-line immutable/no-mutation
        draft.backend.connection = connection;
      }
    });
  };

  return {
    model: store.model,

    requestMessageChange: ({ value }) => {
      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.messageInput = value;
        }
      });
    },

    requestSend: () => {
      const { backend: { connection }, ui: { messageInput } } = store.model();

      if (!canSend({ connection, messageInput })) {
        return;
      }

      socket.send({ text: messageInput });

      const messages = withMessage({ direction: EDirection.SENT, text: messageInput });

      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.messages = messages;
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.messageInput = "";
        }
      });
    },

    connected: () => {
      setConnection({ connection: EConnection.OPEN });
    },

    connectionLost: () => {
      setConnection({ connection: EConnection.CLOSED });
    },

    messageFromBackend: ({ text }) => {
      const messages = withMessage({ direction: EDirection.RECEIVED, text });

      store.update({
        recipe: ({ draft }) => {
          // eslint-disable-next-line immutable/no-mutation
          draft.ui.messages = messages;
        }
      });
    }
  };
};

export {
  canSend,
  createDemoLogic
};

export type {
  TDemoLogic,
  TDemoSocket
};
