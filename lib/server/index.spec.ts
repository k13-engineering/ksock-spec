/*
 * The WebSocket constructor is not on the no-new allow list, and there is no factory form of it.
 */
/* eslint-disable k13-engineering/no-new */
import assert from "node:assert";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "mocha";
import { startServer } from "../index.ts";

const frontendFolder = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), "../../frontend");

type TServer = Awaited<ReturnType<typeof startServer>>;

type TServedModule = {
  // where the module was served from, after redirects
  url: string;
  status: number;
  contentType: string | null;
  code: string;
};

const fetchModule = async ({ url }: { url: string }): Promise<TServedModule> => {
  const response = await fetch(url);

  return {
    url: response.url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    code: await response.text()
  };
};

// the urls of the modules a served module imports, static imports only
const importedUrlsOf = ({ module }: { module: TServedModule }) => {
  return [...module.code.matchAll(/\b(?:from|import)\s*"([^"]+)"/g)].map((match) => {
    return new URL(match[1], module.url).href;
  });
};

/*
 * Every module the urls import, directly or not, as the server serves them, by the url they were served from. wurzel
 * serves a file only once a module it served imports it, so the modules are fetched in the order a browser would.
 */
const moduleGraphOf = async ({
  urls,
  served = {}
}: {
  urls: string[],
  served?: { [url: string]: TServedModule }
}): Promise<{ [url: string]: TServedModule }> => {
  const unseen = [...new Set(urls)].filter((url) => {
    return served[url] === undefined;
  });

  if (unseen.length === 0) {
    return served;
  }

  const modules = await Promise.all(unseen.map((url) => {
    return fetchModule({ url });
  }));

  const servedByUrl = Object.fromEntries(modules.map((module) => {
    return [module.url, module];
  }));

  return moduleGraphOf({
    urls: modules.flatMap((module) => {
      return importedUrlsOf({ module });
    }),
    served: { ...served, ...servedByUrl }
  });
};

// a websocket, once it is open
const connect = ({ url }: { url: string }) => {
  return new Promise<WebSocket>((resolve, reject) => {
    const webSocket = new WebSocket(url);

    webSocket.addEventListener("open", () => {
      resolve(webSocket);
    });

    webSocket.addEventListener("error", () => {
      reject(Error(`failed to connect to ${url}`));
    });
  });
};

// the data of the next message the websocket receives
const nextMessageOf = ({ webSocket }: { webSocket: WebSocket }) => {
  return new Promise<unknown>((resolve) => {
    webSocket.addEventListener("message", (event) => {
      resolve(event.data);
    }, { once: true });
  });
};

describe("server", () => {
  let server: TServer | undefined = undefined;

  const urlOf = ({ path }: { path: string }) => {
    return `http://localhost:${server?.port}${path}`;
  };

  const socketUrlOf = ({ path }: { path: string }) => {
    return `ws://localhost:${server?.port}${path}`;
  };

  beforeEach(async () => {
    server = await startServer({ frontendFolder, port: 0 });
  });

  afterEach(async () => {
    await server?.close();
  });

  it("should serve the spec with its sections and the live demo", async () => {
    const response = await fetch(urlOf({ path: "/" }));
    const html = await response.text();

    assert.strictEqual(response.status, 200);
    ["core", "libraries", "approaches", "live-demo"].forEach((section) => {
      assert.match(html, new RegExp(`<section id="${section}">`));
    });
    assert.match(html, /<script type="module" src="index.ts"/);
  });

  it("should serve every module of the spec as javascript", async () => {
    const modules = Object.values(await moduleGraphOf({ urls: [urlOf({ path: "/index.ts" })] }));

    modules.forEach((module) => {
      assert.strictEqual(module.status, 200, module.url);
      assert.strictEqual(module.contentType, "text/javascript", module.url);
    });

    const paths = modules.map((module) => {
      return decodeURIComponent(new URL(module.url).pathname);
    });

    ["/lib/demo/view-model.ts", "/lib/model-store.ts", "/immer/dist/immer.production.mjs", "/proxy-memoize/"].forEach((part) => {
      assert.ok(paths.some((path) => {
        return path.includes(part);
      }), `${part} is not among ${paths.join(", ")}`);
    });
  });

  it("should serve the typescript of the frontend without its types", async () => {
    const entry = await fetchModule({ url: urlOf({ path: "/index.ts" }) });

    assert.match(entry.code, /createDemoApp/);
    assert.doesNotMatch(entry.code, /as HTMLElement/);
  });

  it("should send every text message of the demo socket back as text", async () => {
    const webSocket = await connect({ url: socketUrlOf({ path: "/api/demo" }) });
    const echo = nextMessageOf({ webSocket });

    webSocket.send("hello");

    assert.strictEqual(await echo, "hello");
    webSocket.close();
  });

  it("should send every binary message of the demo socket back as binary", async () => {
    const webSocket = await connect({ url: socketUrlOf({ path: "/api/demo" }) });
    const echo = nextMessageOf({ webSocket });

    webSocket.send(new Uint8Array([1, 2, 3]));

    const data = await echo;
    assert.ok(data instanceof Blob);
    assert.deepStrictEqual(new Uint8Array(await data.arrayBuffer()), new Uint8Array([1, 2, 3]));
    webSocket.close();
  });

  it("should refuse a websocket at any other path", async () => {
    await assert.rejects(connect({ url: socketUrlOf({ path: "/api/unknown" }) }));
  });

  it("should close the websockets when it closes", async () => {
    const webSocket = await connect({ url: socketUrlOf({ path: "/api/demo" }) });
    const closed = new Promise<void>((resolve) => {
      webSocket.addEventListener("close", () => {
        resolve();
      });
    });

    // closed here, so not again after the test
    const closing = server;
    server = undefined;
    await closing?.close();

    await closed;
  });

  it("should fail to start on a port in use", async () => {
    await assert.rejects(startServer({ frontendFolder, port: server?.port as number }), {
      message: `failed to listen on port ${server?.port}`
    });
  });
});
