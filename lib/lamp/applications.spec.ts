import assert from "node:assert";
import {
  deserialize,
  serialize,
  type Document
} from "bson";
import { describe, it } from "mocha";
import { createFakeTimers } from "../ksock/fake-timers.ts";
import type { TPatchOperation } from "../model-sync/patch.ts";
import { createLampBackend } from "./backend.ts";
import { createLampClientApplication } from "./client.ts";
import { createLampServerApplication } from "./server.ts";

// lets the promises of answered requests settle
const settle = () => {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
};

const dataOf = ({ document }: { document: Document }) => {
  return serialize({ jsonrpc: "2.0", ...document });
};

// an application that records the documents it sends
const createRecording = () => {
  let sent: Document[] = [];

  return {
    send: ({ data }: { data: Uint8Array }) => {
      sent = [...sent, deserialize(data)];
    },

    sent: () => {
      return sent;
    }
  };
};

// a die that always shows 1
const random = () => {
  return 0;
};

const writable = () => {
  return true;
};

const createServerApplication = () => {
  const { timers, advance } = createFakeTimers();
  const backend = createLampBackend({ delayMs: 10, timers, random });
  const recording = createRecording();
  const application = createLampServerApplication({ backend })({ send: recording.send, writable });

  return {
    ...recording,
    application,
    backend,
    advance
  };
};

const createClientApplication = () => {
  let patches: TPatchOperation[][] = [];
  const recording = createRecording();

  const application = createLampClientApplication({
    onReady: () => {},
    onModelPatch: ({ patch }) => {
      patches = [...patches, patch];
    },
    onClosed: () => {}
  })({ send: recording.send, writable });

  return {
    ...recording,
    application,

    patches: () => {
      return patches;
    }
  };
};

describe("lamp server application", () => {
  it("should send the backend model once the client said hello", () => {
    const { application, sent } = createServerApplication();

    application.ready();

    assert.deepStrictEqual(sent().map(({ method }) => {
      return method;
    }), ["modelPatch"]);
  });

  it("should ignore notifications it does not know or cannot read", () => {
    const { application, sent, advance } = createServerApplication();

    application.ready();
    application.received({ data: dataOf({ document: { method: "shout" } }) });
    application.received({ data: dataOf({ document: { method: "switchLamp", params: { on: true } } }) });
    advance({ ms: 10 });

    assert.strictEqual(sent().length, 1);
  });

  it("should roll a die for a request, and answer requests it does not know with an error", async () => {
    const { application, sent, advance } = createServerApplication();

    application.ready();
    application.received({ data: dataOf({ document: { id: 1, method: "rollDie" } }) });
    application.received({ data: dataOf({ document: { id: 2, method: "divide" } }) });
    advance({ ms: 10 });
    await settle();

    assert.deepStrictEqual(sent().slice(1), [
      { jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } },
      { jsonrpc: "2.0", result: { value: 1 }, id: 1 }
    ]);
  });

  it("should stop telling a closed client of changes, also one closed before it said hello", () => {
    const { application, backend, sent, advance } = createServerApplication();
    const early = createServerApplication().application;

    early.closed({ code: 1006 });
    application.ready();
    application.closed({ code: 1006 });
    backend.connect({ onModelChanged: () => {} }).switchLamp({ requestSequence: 1, on: true });
    advance({ ms: 10 });

    assert.strictEqual(sent().length, 1);
  });
});

describe("lamp client application", () => {
  it("should hand the page the patches of the backend model", () => {
    const { application, patches } = createClientApplication();
    const patch = [{ op: "add", path: "/requestSequence", value: 0 }];

    application.received({ data: dataOf({ document: { method: "modelPatch", params: { patch } } }) });

    assert.deepStrictEqual(patches(), [patch]);
  });

  it("should ignore notifications it does not know or cannot read", () => {
    const { application, patches } = createClientApplication();

    application.received({ data: dataOf({ document: { method: "shout" } }) });
    application.received({ data: dataOf({ document: { method: "modelPatch", params: { patch: "all" } } }) });
    application.writable();

    assert.deepStrictEqual(patches(), []);
  });

  it("should answer requests with an error, as a client has none", async () => {
    const { application, sent } = createClientApplication();

    application.received({ data: dataOf({ document: { id: 1, method: "rollDie" } }) });
    await settle();

    assert.deepStrictEqual(sent(), [{ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }]);
  });

  it("should send switches as notifications, and rolls as requests, with their results", async () => {
    const { application, sent } = createClientApplication();

    application.backend.switchLamp({ requestSequence: 1, on: true });
    const roll = application.backend.rollDie();
    application.received({ data: dataOf({ document: { id: sent()[1].id, result: { value: 5 } } }) });

    assert.deepStrictEqual(sent()[0], { jsonrpc: "2.0", method: "switchLamp", params: { requestSequence: 1, on: true } });
    assert.deepStrictEqual(await roll, { value: 5 });
  });

  it("should give no result for a roll that failed", async () => {
    const { application } = createClientApplication();

    const roll = application.backend.rollDie();
    application.closed({ code: 1006 });

    assert.strictEqual(await roll, undefined);
  });
});
