import assert from "node:assert";
import { Binary, type Document } from "bson";
import { describe, it } from "mocha";
import { bytesOf, createTestConnection, defaultSettings } from "./test-connection.ts";

const countOf = ({ sent, summary }: { sent: string[], summary: string }) => {
  return sent.filter((each) => {
    return each === summary;
  }).length;
};

const messagesOf = ({ sent }: { sent: string[] }) => {
  return sent.filter((each) => {
    return each.startsWith("message ");
  });
};

// the size of the message notification that carries the text, the size a grant is counted in
const sizeOf = ({ text }: { text: string }) => {
  // eslint-disable-next-line k13-engineering/no-new
  return bytesOf({ document: { method: "message", params: { data: new Binary(new TextEncoder().encode(text)) } } }).length;
};

const grantBytes = ({ messages, bytes }: { messages: number, bytes: number }) => {
  return bytesOf({ document: { method: "grant", params: { messages, bytes } } });
};

const hello = ({ protocol = "ksock", version = 1 }: { protocol?: string, version?: number }): Document => {
  return { method: "hello", params: { protocol, version, heartbeatTimeout: 1000 } };
};

describe("ksock endpoint", () => {
  describe("opening", () => {
    it("should let the client say hello and grant first, and the server answer only then", () => {
      const { client, server, pump } = createTestConnection();

      client.endpoint.opened();
      server.endpoint.opened();

      assert.deepStrictEqual(client.sent(), ["hello ksock 1 1000", "grant 16 65536"]);
      assert.deepStrictEqual(server.sent(), []);

      pump();

      assert.deepStrictEqual(server.sent(), ["hello ksock 1 1000", "grant 16 65536"]);
      assert.deepStrictEqual(client.app.events(), ["ready", "writable"]);
      assert.deepStrictEqual(server.app.events(), ["ready", "writable"]);
    });

    it("should keep the server silent for a connection without hello, and close it after its heartbeat timeout", () => {
      const { server, advance } = createTestConnection();

      server.endpoint.opened();
      advance({ ms: 999 });

      assert.strictEqual(server.closeCode(), undefined);

      advance({ ms: 1 });

      assert.deepStrictEqual(server.sent(), []);
      assert.strictEqual(server.closeCode(), 4002);
      assert.deepStrictEqual(server.app.events(), ["closed 4002"]);
    });

    it("should close with 4000 for anything but a hello first, without saying anything", () => {
      const { server } = createTestConnection();

      server.endpoint.opened();
      server.endpoint.received({ bytes: grantBytes({ messages: 1, bytes: 1 }) });

      assert.strictEqual(server.closeCode(), 4000);
      assert.deepStrictEqual(server.sent(), []);
    });

    it("should close with 4000 for a hello of another protocol", () => {
      const { server } = createTestConnection();

      server.endpoint.opened();
      server.endpoint.received({ bytes: bytesOf({ document: hello({ protocol: "other" }) }) });

      assert.strictEqual(server.closeCode(), 4000);
    });

    it("should close with 4001 for a hello of another version, without a hello of its own", () => {
      const { server } = createTestConnection();

      server.endpoint.opened();
      server.endpoint.received({ bytes: bytesOf({ document: hello({ version: 2 }) }) });

      assert.strictEqual(server.closeCode(), 4001);
      assert.deepStrictEqual(server.sent(), []);
      assert.deepStrictEqual(server.app.events(), ["closed 4001"]);
    });

    it("should close with 4000 for a second hello", () => {
      const { client, open } = createTestConnection();

      open();
      client.endpoint.received({ bytes: bytesOf({ document: hello({}) }) });

      assert.strictEqual(client.closeCode(), 4000);
    });
  });

  describe("messages on the wire", () => {
    type TEndpoint = ReturnType<typeof createTestConnection>["server"]["endpoint"];

    const violations: { name: string, receive: (args: { endpoint: TEndpoint }) => void }[] = [
      {
        name: "a text message",
        receive: ({ endpoint }) => {
          endpoint.receivedText();
        }
      },
      {
        name: "a message that is not BSON",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: new Uint8Array([1, 2, 3]) });
        }
      },
      {
        name: "a BSON document with bytes after it",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: new Uint8Array([...bytesOf({ document: { method: "heartbeat" } }), 0]) });
        }
      },
      {
        name: "an unknown notification",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: bytesOf({ document: { method: "shout" } }) });
        }
      },
      {
        name: "a request",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: bytesOf({ document: { id: 1, method: "heartbeat" } }) });
        }
      },
      {
        name: "a response",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: bytesOf({ document: { id: 1, result: 1 } }) });
        }
      },
      {
        name: "a grant of negative messages",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: grantBytes({ messages: -1, bytes: 1 }) });
        }
      },
      {
        name: "a heartbeat with parameters",
        receive: ({ endpoint }) => {
          endpoint.received({ bytes: bytesOf({ document: { method: "heartbeat", params: {} } }) });
        }
      }
    ];

    violations.forEach(({ name, receive }) => {
      it(`should close with 4000 for ${name}`, () => {
        const { server, open } = createTestConnection();

        open();
        receive({ endpoint: server.endpoint });

        assert.strictEqual(server.closeCode(), 4000);
        assert.deepStrictEqual(server.app.events(), ["ready", "writable", "closed 4000"]);
      });
    });

    it("should hand the application the data of a message as it was sent", () => {
      const { client, server, open, pump } = createTestConnection();

      open();
      client.app.sendText({ text: "hello, server" });
      pump();

      assert.deepStrictEqual(server.app.events(), ["ready", "writable", "received hello, server"]);
    });
  });

  describe("grants", () => {
    it("should send no message before the first grant", () => {
      const { client, server, pump } = createTestConnection();

      client.endpoint.opened();
      server.endpoint.opened();
      client.app.sendText({ text: "early" });

      assert.deepStrictEqual(messagesOf({ sent: client.sent() }), []);

      pump();

      assert.deepStrictEqual(messagesOf({ sent: client.sent() }), ["message early"]);
    });

    it("should let a grant set the credit, not add to what is left of it", () => {
      const { client, open } = createTestConnection();

      open();
      client.endpoint.received({ bytes: grantBytes({ messages: 1, bytes: 65536 }) });
      client.app.sendText({ text: "a" });
      client.app.sendText({ text: "b" });

      assert.deepStrictEqual(messagesOf({ sent: client.sent() }), ["message a"]);
      assert.strictEqual(client.app.canSend(), false);
    });

    it("should hold back a message its bytes do not cover, and the ones after it", () => {
      const { client, open } = createTestConnection();

      open();
      client.endpoint.received({ bytes: grantBytes({ messages: 10, bytes: sizeOf({ text: "long text" }) - 1 }) });
      client.app.sendText({ text: "long text" });
      client.app.sendText({ text: "a" });

      assert.deepStrictEqual(messagesOf({ sent: client.sent() }), []);

      client.endpoint.received({ bytes: grantBytes({ messages: 10, bytes: 65536 }) });

      assert.deepStrictEqual(messagesOf({ sent: client.sent() }), ["message long text", "message a"]);
    });

    it("should grant again once half of the messages of the last grant are used up", () => {
      const { client, server, open, pump } = createTestConnection({ server: { ...defaultSettings, grant: { messages: 4, bytes: 65536 } } });

      open();
      client.app.sendText({ text: "a" });
      pump();

      assert.strictEqual(countOf({ sent: server.sent(), summary: "grant 4 65536" }), 1);

      client.app.sendText({ text: "b" });
      pump();

      assert.strictEqual(countOf({ sent: server.sent(), summary: "grant 4 65536" }), 2);
    });

    it("should grant again once half of the bytes of the last grant are used up", () => {
      const bytes = sizeOf({ text: "a" }) * 2;
      const { client, server, open, pump } = createTestConnection({ server: { ...defaultSettings, grant: { messages: 100, bytes } } });

      open();
      client.app.sendText({ text: "a" });
      pump();

      assert.strictEqual(countOf({ sent: server.sent(), summary: `grant 100 ${bytes}` }), 2);
    });
  });

  describe("heartbeats", () => {
    // the client waits 1 s for the server, the server 4 s for the client
    const settings = {
      client: { ...defaultSettings, heartbeatTimeout: 1000 },
      server: { ...defaultSettings, heartbeatTimeout: 4000 }
    };

    it("should send a heartbeat once nothing went out for half the timeout of the other endpoint", () => {
      const { client, server, open, advance } = createTestConnection(settings);

      open();
      advance({ ms: 499 });

      assert.strictEqual(countOf({ sent: server.sent(), summary: "heartbeat" }), 0);

      advance({ ms: 1 });

      assert.strictEqual(countOf({ sent: server.sent(), summary: "heartbeat" }), 1);

      advance({ ms: 1499 });

      assert.strictEqual(countOf({ sent: client.sent(), summary: "heartbeat" }), 0);

      advance({ ms: 1 });

      assert.strictEqual(countOf({ sent: client.sent(), summary: "heartbeat" }), 1);
    });

    it("should count every notification sent as a heartbeat", () => {
      const { server, open, advance } = createTestConnection(settings);

      open();
      advance({ ms: 300 });
      server.app.sendText({ text: "a" });
      advance({ ms: 499 });

      assert.strictEqual(countOf({ sent: server.sent(), summary: "heartbeat" }), 0);

      advance({ ms: 1 });

      assert.strictEqual(countOf({ sent: server.sent(), summary: "heartbeat" }), 1);
    });

    it("should keep a connection open with heartbeats", () => {
      const { client, server, open, advance } = createTestConnection(settings);

      open();
      advance({ ms: 60000 });

      assert.strictEqual(client.closeCode(), undefined);
      assert.strictEqual(server.closeCode(), undefined);
      assert.ok(countOf({ sent: client.sent(), summary: "heartbeat" }) >= 29);
    });

    it("should close with 4002 once nothing arrived within its heartbeat timeout, and send nothing more", () => {
      const { client, server, open, advance } = createTestConnection(settings);

      open();
      advance({ ms: 999, deliver: false });

      assert.strictEqual(client.closeCode(), undefined);

      advance({ ms: 1, deliver: false });

      assert.strictEqual(client.closeCode(), 4002);
      assert.strictEqual(server.closeCode(), undefined);

      const sent = client.sent().length;
      advance({ ms: 10000, deliver: false });

      assert.strictEqual(client.sent().length, sent);
    });
  });

  describe("closing", () => {
    it("should close the socket with 1000 when asked to, once", () => {
      const { client, open } = createTestConnection();

      open();
      client.endpoint.close();
      client.endpoint.receivedText();

      assert.strictEqual(client.closeCode(), 1000);
      assert.deepStrictEqual(client.app.events(), ["ready", "writable", "closed 1000"]);
    });

    it("should tell the application when the socket closed, and send and take in nothing more", () => {
      const { client, open, advance } = createTestConnection();

      open();
      const sent = client.sent().length;
      client.endpoint.socketClosed({ code: 1006 });
      client.endpoint.socketClosed({ code: 1006 });
      client.app.sendText({ text: "late" });
      client.endpoint.received({ bytes: grantBytes({ messages: 1, bytes: 1 }) });
      advance({ ms: 10000 });

      assert.strictEqual(client.closeCode(), undefined);
      assert.strictEqual(client.sent().length, sent);
      assert.deepStrictEqual(client.app.events(), ["ready", "writable", "closed 1006"]);
    });
  });
});
