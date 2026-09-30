import assert from "node:assert";
import { describe, it } from "mocha";
import { createApplicationJrpc, requestErrors } from "./application.ts";

// two applications that deliver to each other right away
const createPair = () => {
  let notifications: string[] = [];

  const answerer = createApplicationJrpc({
    send: ({ data }) => {
      // eslint-disable-next-line no-use-before-define
      asker.received({ data });
    },
    handleRequest: async ({ method }) => {
      return method === "add" ? { result: 3, error: undefined } : await requestErrors.handleUnknownRequest();
    },
    handleNotification: ({ method }) => {
      notifications = [...notifications, method];
    }
  });

  const asker = createApplicationJrpc({
    send: ({ data }) => {
      answerer.received({ data });
    },
    handleRequest: requestErrors.handleParametersParseError,
    handleNotification: () => {}
  });

  return {
    answerer,
    asker,

    notifications: () => {
      return notifications;
    }
  };
};

describe("application json-rpc", () => {
  it("should carry notifications, requests and responses in BSON", async () => {
    const { asker, notifications } = createPair();

    asker.notify({ method: "hello", params: {} });
    const { response } = await asker.request({ method: "add", params: { a: 1, b: 2 } });

    assert.deepStrictEqual(notifications(), ["hello"]);
    assert.deepStrictEqual(response, { result: 3, error: undefined });
  });

  it("should answer requests it does not know with an error", async () => {
    const { asker } = createPair();

    const { response } = await asker.request({ method: "divide", params: {} });
    const { code, message } = (response as { error: { code: number, message: string } }).error;

    assert.deepStrictEqual([code, message], [-32601, "Method not found"]);
  });

  it("should answer requests with parameters it cannot read with an error", async () => {
    assert.deepStrictEqual(await requestErrors.handleParametersParseError(), {
      error: { code: -32602, message: "Invalid params" },
      result: undefined
    });
  });

  it("should not take data that is not a BSON document", () => {
    const { answerer } = createPair();

    assert.ok(answerer.received({ data: new Uint8Array([1, 2, 3]) }).error instanceof Error);
  });

  it("should answer pending requests with an error once closed, and take nothing more", async () => {
    const application = createApplicationJrpc({
      send: () => {},
      handleRequest: requestErrors.handleUnknownRequest,
      handleNotification: () => {}
    });

    const pending = application.request({ method: "add", params: {} });
    application.close();
    application.close();

    assert.ok((await pending).error instanceof Error);
    assert.ok(application.received({ data: new Uint8Array() }).error instanceof Error);
  });
});
