import { memoize } from "proxy-memoize";
import type { TButtonViewModel } from "../../frontend/components/button/view-model.ts";
import type { TInputViewModel } from "../../frontend/components/input/view-model.ts";
import { canSend, type TDemoLogic } from "./logic.ts";
import type { EConnection, EDirection, TDemoModel } from "./model.ts";

type TDemoStatusViewModel = {
  text: string;
  // a css color
  color: string;
};

type TDemoMessageViewModel = {
  // which way the message went
  label: string;
  text: string;
};

type TDemoViewModel = {
  status: TDemoStatusViewModel;
  messages: TDemoMessageViewModel[];
  messageInput: TInputViewModel;
  buttonSend: TButtonViewModel;
};

const statuses: { [connection in EConnection]: TDemoStatusViewModel } = {
  CONNECTING: { text: "connecting…", color: "#c98a0b" },
  OPEN: { text: "connected", color: "#1f8a3b" },
  CLOSED: { text: "disconnected, reload the page to connect again", color: "#b3261e" }
};

const directionLabels: { [direction in EDirection]: string } = {
  SENT: "sent",
  RECEIVED: "received"
};

// memoized on its own, so the messages stay the same object while only the message input changes
const createMessagesViewModel = memoize(({ messages }: { messages: TDemoModel["ui"]["messages"] }): TDemoMessageViewModel[] => {
  return messages.map((message) => {
    return {
      label: directionLabels[message.direction],
      text: message.text
    };
  });
});

const createDemoViewModel = memoize(({ model, logic }: { model: TDemoModel, logic: TDemoLogic }): TDemoViewModel => {
  const { backend: { connection }, ui: { messageInput } } = model;

  return {
    status: { ...statuses[connection] },
    messages: createMessagesViewModel({ messages: model.ui.messages }),

    messageInput: {
      value: messageInput,
      onInput: ({ value }) => {
        logic.requestMessageChange({ value });
      }
    },

    buttonSend: {
      enabled: canSend({ connection, messageInput }),
      onClicked: () => {
        logic.requestSend();
      }
    }
  };
});

export {
  createDemoViewModel
};

export type {
  TDemoMessageViewModel,
  TDemoViewModel
};
