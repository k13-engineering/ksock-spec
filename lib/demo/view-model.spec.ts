import assert from "node:assert";
import { describe, it } from "mocha";
import type { TDemoLogic } from "./logic.ts";
import { EConnection, EDirection, type TDemoModel } from "./model.ts";
import { createDemoViewModel } from "./view-model.ts";

const createFakeLogic = () => {
  let requests: string[] = [];

  const record = ({ request }: { request: string }) => {
    requests = [...requests, request];
  };

  const logic: TDemoLogic = {
    model: () => {
      return assert.fail("the view model gets the model passed in");
    },
    requestMessageChange: ({ value }) => {
      record({ request: `message change to ${value}` });
    },
    requestSend: () => {
      record({ request: "send" });
    },
    connected: () => {
      assert.fail("only the socket reports the connection");
    },
    connectionLost: () => {
      assert.fail("only the socket reports the connection");
    },
    messageFromBackend: () => {
      assert.fail("only the socket reports messages");
    }
  };

  return {
    logic,

    requests: () => {
      return requests;
    }
  };
};

const createModel = ({
  connection = EConnection.OPEN,
  messageInput = "",
  messages = []
}: {
  connection?: EConnection,
  messageInput?: string,
  messages?: TDemoModel["ui"]["messages"]
}): TDemoModel => {
  return { backend: { connection }, ui: { messageInput, messages } };
};

describe("demo view model", () => {
  it("should show the connection with a text and a color", () => {
    const { logic } = createFakeLogic();

    const statuses = [EConnection.CONNECTING, EConnection.OPEN, EConnection.CLOSED].map((connection) => {
      return createDemoViewModel({ model: createModel({ connection }), logic }).status;
    });

    assert.deepStrictEqual(statuses, [
      { text: "connecting…", color: "#c98a0b" },
      { text: "connected", color: "#1f8a3b" },
      { text: "disconnected, reload the page to connect again", color: "#b3261e" }
    ]);
  });

  it("should label the messages with the way they went", () => {
    const { logic } = createFakeLogic();
    const messages = [{ direction: EDirection.SENT, text: "hello" }, { direction: EDirection.RECEIVED, text: "hello" }];

    assert.deepStrictEqual(createDemoViewModel({ model: createModel({ messages }), logic }).messages, [
      { label: "sent", text: "hello" },
      { label: "received", text: "hello" }
    ]);
  });

  it("should enable sending only for a message over an open socket", () => {
    const { logic } = createFakeLogic();

    const enabled = [
      createModel({ connection: EConnection.OPEN, messageInput: "hello" }),
      createModel({ connection: EConnection.OPEN, messageInput: "" }),
      createModel({ connection: EConnection.CONNECTING, messageInput: "hello" }),
      createModel({ connection: EConnection.CLOSED, messageInput: "hello" })
    ].map((model) => {
      return createDemoViewModel({ model, logic }).buttonSend.enabled;
    });

    assert.deepStrictEqual(enabled, [true, false, false, false]);
  });

  it("should show the message input as typed and request changes of it", () => {
    const { logic, requests } = createFakeLogic();
    const viewModel = createDemoViewModel({ model: createModel({ messageInput: " hello " }), logic });

    viewModel.messageInput.onInput({ value: " hello! " });

    assert.strictEqual(viewModel.messageInput.value, " hello ");
    assert.deepStrictEqual(requests(), ["message change to  hello! "]);
  });

  it("should request sending for a click of the send button", () => {
    const { logic, requests } = createFakeLogic();

    createDemoViewModel({ model: createModel({ messageInput: "hello" }), logic }).buttonSend.onClicked({ event: new Event("click") });

    assert.deepStrictEqual(requests(), ["send"]);
  });

  it("should return the same view model for an equal model", () => {
    const { logic } = createFakeLogic();

    const first = createDemoViewModel({ model: createModel({ messageInput: "hello" }), logic });
    const second = createDemoViewModel({ model: createModel({ messageInput: "hello" }), logic });

    assert.strictEqual(second, first);
  });

  it("should keep the messages while only the message input changes", () => {
    const { logic } = createFakeLogic();
    const messages = [{ direction: EDirection.SENT, text: "hello" }];

    const first = createDemoViewModel({ model: createModel({ messages, messageInput: "a" }), logic });
    const second = createDemoViewModel({ model: createModel({ messages, messageInput: "ab" }), logic });

    assert.notStrictEqual(second, first);
    assert.strictEqual(second.messages, first.messages);
  });
});
