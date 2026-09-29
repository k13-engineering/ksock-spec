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

describe("server", () => {
  let server: TServer | undefined = undefined;

  const urlOf = ({ path }: { path: string }) => {
    return `http://localhost:${server?.port}${path}`;
  };

  beforeEach(async () => {
    server = await startServer({ frontendFolder, port: 0 });
  });

  afterEach(async () => {
    await server?.close();
  });

  it("should serve the overview, which links the hello page", async () => {
    const response = await fetch(urlOf({ path: "/" }));

    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /href="\/hello\/"/);
  });

  it("should serve the hello page with its entry point", async () => {
    const response = await fetch(urlOf({ path: "/hello/" }));

    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /<script type="module" src="index.ts"/);
  });

  it("should serve every module of the hello page as javascript", async () => {
    const modules = Object.values(await moduleGraphOf({ urls: [urlOf({ path: "/hello/index.ts" })] }));

    modules.forEach((module) => {
      assert.strictEqual(module.status, 200, module.url);
      assert.strictEqual(module.contentType, "text/javascript", module.url);
    });

    const paths = modules.map((module) => {
      return decodeURIComponent(new URL(module.url).pathname);
    });

    ["/lib/hello/view-model.ts", "/lib/model-store.ts", "/immer/dist/immer.production.mjs", "/proxy-memoize/"].forEach((part) => {
      assert.ok(paths.some((path) => {
        return path.includes(part);
      }), `${part} is not among ${paths.join(", ")}`);
    });
  });

  it("should serve the typescript of the frontend without its types", async () => {
    const entry = await fetchModule({ url: urlOf({ path: "/hello/index.ts" }) });

    assert.match(entry.code, /createHelloLogic/);
    assert.doesNotMatch(entry.code, /THelloLogic|as HTMLElement/);
  });

  it("should fail to start on a port in use", async () => {
    await assert.rejects(startServer({ frontendFolder, port: server?.port as number }), {
      message: `failed to listen on port ${server?.port}`
    });
  });
});
