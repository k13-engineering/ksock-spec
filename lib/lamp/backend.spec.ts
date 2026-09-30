import assert from "node:assert";
import { describe, it } from "mocha";
import { createFakeTimers } from "../ksock/fake-timers.ts";
import { createLampBackend } from "./backend.ts";
import type { TLampBackendModel } from "./protocol.ts";

// a die that always shows 4
const random = () => {
  return 0.5;
};

const createTestBackend = () => {
  const { timers, advance } = createFakeTimers();
  const backend = createLampBackend({ delayMs: 1500, timers, random });

  // a session that records every model it was told of
  const connect = () => {
    let models: TLampBackendModel[] = [];

    const session = backend.connect({
      onModelChanged: ({ model }) => {
        models = [...models, model];
      }
    });

    return {
      session,

      models: () => {
        return models;
      }
    };
  };

  return {
    backend,
    connect,
    advance
  };
};

describe("lamp backend", () => {
  it("should give a new session the lamp off and the sequence 0", () => {
    const { connect } = createTestBackend();

    assert.deepStrictEqual(connect().session.model(), { lamp: { on: false }, requestSequence: 0 });
  });

  it("should switch the lamp after its delay, and mirror the sequence in the same change", () => {
    const { connect, advance } = createTestBackend();
    const client = connect();

    client.session.switchLamp({ requestSequence: 1, on: true });
    advance({ ms: 1499 });

    assert.deepStrictEqual(client.models(), []);

    advance({ ms: 1 });

    assert.deepStrictEqual(client.models(), [{ lamp: { on: true }, requestSequence: 1 }]);
  });

  it("should process a request once, even if it is sent again", () => {
    const { connect, advance } = createTestBackend();
    const client = connect();

    client.session.switchLamp({ requestSequence: 1, on: true });
    client.session.switchLamp({ requestSequence: 1, on: true });
    advance({ ms: 1500 });
    client.session.switchLamp({ requestSequence: 1, on: false });
    advance({ ms: 1500 });

    assert.deepStrictEqual(client.models(), [{ lamp: { on: true }, requestSequence: 1 }]);
  });

  it("should mirror a request that changes nothing too", () => {
    const { connect, advance } = createTestBackend();
    const client = connect();

    client.session.switchLamp({ requestSequence: 1, on: false });
    advance({ ms: 1500 });

    assert.deepStrictEqual(client.models(), [{ lamp: { on: false }, requestSequence: 1 }]);
  });

  it("should tell every session of a switch, each with its own sequence", () => {
    const { connect, advance } = createTestBackend();
    const client = connect();
    const other = connect();

    other.session.switchLamp({ requestSequence: 1, on: true });
    advance({ ms: 1500 });

    assert.deepStrictEqual(client.models(), [{ lamp: { on: true }, requestSequence: 0 }]);
    assert.deepStrictEqual(other.models(), [{ lamp: { on: true }, requestSequence: 1 }]);
  });

  it("should tell a disconnected session nothing more", () => {
    const { connect, advance } = createTestBackend();
    const client = connect();
    const other = connect();

    client.session.disconnect();
    other.session.switchLamp({ requestSequence: 1, on: true });
    advance({ ms: 1500 });

    assert.deepStrictEqual(client.models(), []);
  });

  it("should roll a die after its delay", async () => {
    const { connect, advance } = createTestBackend();
    const roll = connect().session.rollDie();

    advance({ ms: 1500 });

    assert.deepStrictEqual(await roll, { value: 4 });
  });

  it("should drop what is waiting when it stops", () => {
    const { backend, connect, advance } = createTestBackend();
    const client = connect();

    client.session.switchLamp({ requestSequence: 1, on: true });
    backend.stop();
    advance({ ms: 1500 });

    assert.deepStrictEqual(client.models(), []);
  });
});
