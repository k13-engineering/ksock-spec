import assert from "node:assert";
import { describe, it } from "mocha";
import { createDemoLogic } from "./logic.ts";
import { EConnection, EDirection, type TDemoModel } from "./model.ts";

// the logic with a socket that records what was sent, and every model it signalled an update for
const createRecordingLogic = () => {
  let sent: string[] = [];
  let models: TDemoModel[] = [];

  const logic = createDemoLogic({
    socket: {
      send: ({ text }) => {
        sent = [...sent, text];
      }
    },

    onUpdate: () => {
      models = [...models, logic.model()];
    }
  });

  return {
    logic,

    sent: () => {
      return sent;
    },

    models: () => {
      return models;
    }
  };
};

describe("demo logic", () => {
  it("should start connecting, without messages", () => {
    const { logic } = createRecordingLogic();

    assert.deepStrictEqual(logic.model(), {
      backend: { connection: EConnection.CONNECTING },
      ui: { messageInput: "", messages: [] }
    });
  });

  it("should follow the connection as the socket reports it", () => {
    const { logic, models } = createRecordingLogic();

    logic.connected();
    logic.connectionLost();

    assert.deepStrictEqual(models().map((model) => {
      return model.backend.connection;
    }), [EConnection.OPEN, EConnection.CLOSED]);
  });

  it("should keep the message input as typed", () => {
    const { logic } = createRecordingLogic();

    logic.requestMessageChange({ value: " hello " });

    assert.strictEqual(logic.model().ui.messageInput, " hello ");
  });

  it("should send the message as typed over an open socket, log it and clear the input", () => {
    const { logic, sent } = createRecordingLogic();

    logic.connected();
    logic.requestMessageChange({ value: " hello " });
    logic.requestSend();

    assert.deepStrictEqual(sent(), [" hello "]);
    assert.deepStrictEqual(logic.model().ui, {
      messageInput: "",
      messages: [{ direction: EDirection.SENT, text: " hello " }]
    });
  });

  it("should not send before the socket is open", () => {
    const { logic, sent, models } = createRecordingLogic();

    logic.requestMessageChange({ value: "hello" });
    logic.requestSend();

    assert.deepStrictEqual(sent(), []);
    assert.strictEqual(models().length, 1);
  });

  it("should not send an empty message", () => {
    const { logic, sent } = createRecordingLogic();

    logic.connected();
    logic.requestSend();

    assert.deepStrictEqual(sent(), []);
  });

  it("should log the messages of the server after the ones before", () => {
    const { logic } = createRecordingLogic();

    logic.connected();
    logic.requestMessageChange({ value: "hello" });
    logic.requestSend();
    logic.messageFromBackend({ text: "hello" });

    assert.deepStrictEqual(logic.model().ui.messages, [
      { direction: EDirection.SENT, text: "hello" },
      { direction: EDirection.RECEIVED, text: "hello" }
    ]);
  });
});
