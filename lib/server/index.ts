import express from "express";
import nodeHttp from "node:http";
import type { AddressInfo } from "node:net";
import { wurzelExpressRouter } from "wurzel";
import { resolveImportPath } from "./resolve-import-path.ts";

const createApp = ({ frontendFolder }: { frontendFolder: string }) => {
  const app = express();

  // wurzel serves the typescript sources of the frontend, transpiled on the fly
  app.use("/", wurzelExpressRouter({
    express,
    baseFolder: frontendFolder,
    resolveImportPath
  }));

  return app;
};

const listen = ({ httpServer, port }: { httpServer: nodeHttp.Server, port: number }) => {
  return new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
};

const startServer = async ({ frontendFolder, port }: { frontendFolder: string, port: number }) => {
  const httpServer = nodeHttp.createServer(createApp({ frontendFolder }));

  try {
    await listen({ httpServer, port });
  } catch (ex) {
    throw Error(`failed to listen on port ${port}`, { cause: ex });
  }

  const close = async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
      httpServer.closeAllConnections();
    });
  };

  const { port: listeningPort } = httpServer.address() as AddressInfo;

  return {
    port: listeningPort,
    close
  };
};

export {
  startServer
};
