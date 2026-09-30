/*
 * The WebSocket constructor is not on the no-new allow list, and there is no factory form of it.
 */
/* eslint-disable k13-engineering/no-new */
import assert from "node:assert";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "mocha";
import { openKsockSocket } from "../../frontend/browser/ksock-socket.ts";
import { startServer } from "../index.ts";
import { createLampClientApplication } from "../lamp/client.ts";
import { createLampLogic } from "../lamp/logic.ts";
import { EConnection, type TLampModel } from "../lamp/model.ts";
import { lampKsockSettings } from "../lamp/settings.ts";

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

// the urls of the modules a served module imports, static imports only, not the ones in comments, e.g. the type imports
// the build of yajrpc keeps as comments
const importedUrlsOf = ({ module }: { module: TServedModule }) => {
  const code = module.code.replaceAll(/\/\*[\s\S]*?\*\//g, "");

  return [...code.matchAll(/\b(?:from|import)\s*"([^"]+)"/g)].map((match) => {
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

// the code the websocket closes with
const closeCodeOf = ({ webSocket }: { webSocket: WebSocket }) => {
  return new Promise<number>((resolve) => {
    webSocket.addEventListener("close", (event) => {
      resolve(event.code);
    });
  });
};

// a page of the lamp demo without its view: its logic, connected to the server as the browser connects it
const openLampPage = ({ url }: { url: string }) => {
  let models: TLampModel[] = [];
  let listeners: (() => void)[] = [];

  const logic = createLampLogic({
    backend: openKsockSocket({
      url,
      settings: lampKsockSettings,
      application: createLampClientApplication({
        onReady: () => {
          logic.connected();
        },
        onModelPatch: ({ patch }) => {
          logic.modelPatchFromBackend({ patch });
        },
        onClosed: () => {
          logic.connectionLost();
        }
      })
    }).application.backend,

    onUpdate: () => {
      models = [...models, logic.model()];
      listeners.forEach((listener) => {
        listener();
      });
    }
  });

  const waitFor = ({ condition }: { condition: (model: TLampModel) => boolean }) => {
    return new Promise<TLampModel>((resolve) => {
      const check = () => {
        if (condition(logic.model())) {
          listeners = listeners.filter((listener) => {
            return listener !== check;
          });
          resolve(logic.model());
        }
      };

      listeners = [...listeners, check];
      check();
    });
  };

  return {
    logic,
    waitFor,

    // every model the logic had
    models: () => {
      return models;
    },

    // connected, with the backend model
    ready: () => {
      return waitFor({
        condition: ({ backend }) => {
          return backend.connection === EConnection.OPEN && backend.model !== undefined;
        }
      });
    }
  };
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
    server = await startServer({ frontendFolder, port: 0, lampDelayMs: 20 });
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

    [
      "/lib/lamp/view-model.ts",
      "/lib/ksock/endpoint.ts",
      "/lib/model-store.ts",
      "/immer/dist/immer.production.mjs",
      "/proxy-memoize/",
      "/bson/lib/bson.mjs",
      "/@k13engineering/yajrpc/"
    ].forEach((part) => {
      assert.ok(paths.some((path) => {
        return path.includes(part);
      }), `${part} is not among ${paths.join(", ")}`);
    });
  });

  it("should serve the typescript of the frontend without its types", async () => {
    const entry = await fetchModule({ url: urlOf({ path: "/index.ts" }) });

    assert.match(entry.code, /createLampApp/);
    assert.doesNotMatch(entry.code, /as HTMLElement/);
  });

  describe("lamp demo", () => {
    const lampUrl = () => {
      return socketUrlOf({ path: "/api/lamp" });
    };

    it("should send a page the backend model once it said hello", async () => {
      const page = openLampPage({ url: lampUrl() });

      const { backend } = await page.ready();

      assert.deepStrictEqual(backend.model, { lamp: { on: false }, requestSequence: 0 });
    });

    it("should switch the lamp for a request, and mirror its sequence in the patch with the result", async () => {
      const page = openLampPage({ url: lampUrl() });
      await page.ready();

      page.logic.requestSwitch();

      assert.strictEqual(page.logic.model().ui.switchRequestSequence, 1);

      const { backend } = await page.waitFor({
        condition: (model) => {
          return (model.backend.model?.requestSequence ?? 0) >= 1;
        }
      });

      assert.deepStrictEqual(backend.model, { lamp: { on: true }, requestSequence: 1 });
      assert.ok(!page.models().some((model) => {
        return model.backend.model?.lamp.on === true && model.backend.model.requestSequence === 0;
      }), "the lamp was on before the request was mirrored");
    });

    it("should show the lamp another page switched, with the sequence of this page", async () => {
      const page = openLampPage({ url: lampUrl() });
      const other = openLampPage({ url: lampUrl() });
      await page.ready();
      await other.ready();

      other.logic.requestSwitch();

      const { backend } = await page.waitFor({
        condition: (model) => {
          return model.backend.model?.lamp.on === true;
        }
      });

      assert.strictEqual(backend.model?.requestSequence, 0);
    });

    it("should roll a die out of band, for the page that asked only", async () => {
      const page = openLampPage({ url: lampUrl() });
      const other = openLampPage({ url: lampUrl() });
      await page.ready();
      await other.ready();

      await page.logic.requestRoll();

      const { dieValue } = page.logic.model().ui;
      assert.ok(dieValue !== undefined && dieValue >= 1 && dieValue <= 6);
      assert.strictEqual(other.logic.model().ui.dieValue, undefined);
    });

    it("should tell a page when the connection is lost", async () => {
      const page = openLampPage({ url: lampUrl() });
      await page.ready();

      // closed here, so not again after the test
      const closing = server;
      server = undefined;
      await closing?.close();

      await page.waitFor({
        condition: ({ backend }) => {
          return backend.connection === EConnection.CLOSED;
        }
      });
    });

    it("should close with 4000 a connection that sends text", async () => {
      const webSocket = await connect({ url: lampUrl() });
      const closeCode = closeCodeOf({ webSocket });

      webSocket.send("hello");

      assert.strictEqual(await closeCode, 4000);
    });

    it("should say nothing to a connection until it says hello", async () => {
      const webSocket = await connect({ url: lampUrl() });
      let received = 0;

      webSocket.addEventListener("message", () => {
        received += 1;
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      assert.strictEqual(received, 0);
      webSocket.close();
    });
  });

  it("should refuse a websocket at any other path", async () => {
    await assert.rejects(connect({ url: socketUrlOf({ path: "/api/unknown" }) }));
  });

  it("should fail to start on a port in use", async () => {
    await assert.rejects(startServer({ frontendFolder, port: server?.port as number, lampDelayMs: 20 }), {
      message: `failed to listen on port ${server?.port}`
    });
  });
});
