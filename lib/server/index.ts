import express from "express";
import nodeHttp from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { wurzelExpressRouter } from "wurzel";
import { systemTimers } from "../ksock/timers.ts";
import { createLampBackend } from "../lamp/backend.ts";
import { createLampServerApplication } from "../lamp/server.ts";
import { lampKsockSettings } from "../lamp/settings.ts";
import { serveKsockSocket } from "./ksock-socket.ts";
import { resolveImportPath } from "./resolve-import-path.ts";

type TServeWebSocket = (args: { webSocket: WebSocket }) => void;

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

/*
 * The WebSockets borrow the HTTP server Express is already using: each path claims the upgrade requests arriving at
 * it, so all protocols share a single port. An upgrade request for any other path is answered with 404.
 */
const routeWebSockets = ({
  httpServer,
  serveByPath
}: {
  httpServer: nodeHttp.Server,
  serveByPath: Map<string, TServeWebSocket>
}) => {
  // eslint-disable-next-line k13-engineering/no-new
  const webSocketServer = new WebSocketServer({ noServer: true });

  // node dictates the positional parameters of its event listeners
  // eslint-disable-next-line k13-engineering/prefer-single-object-parameters
  httpServer.on("upgrade", (request, socket, head) => {
    // an upgrade request always has a url
    const serve = serveByPath.get(new URL(request.url as string, "http://localhost").pathname);

    if (serve === undefined) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      serve({ webSocket });
    });
  });

  return {
    close: () => {
      webSocketServer.clients.forEach((client) => {
        client.terminate();
      });
      webSocketServer.close();
    }
  };
};

const startServer = async ({
  frontendFolder,
  port,
  lampDelayMs
}: {
  frontendFolder: string,
  port: number,
  // how long the backend of the lamp demo takes for a request, so the spinners can be seen
  lampDelayMs: number
}) => {
  const httpServer = nodeHttp.createServer(createApp({ frontendFolder }));
  const lampBackend = createLampBackend({ delayMs: lampDelayMs, timers: systemTimers, random: Math.random });

  try {
    await listen({ httpServer, port });
  } catch (ex) {
    throw Error(`failed to listen on port ${port}`, { cause: ex });
  }

  const webSockets = routeWebSockets({
    httpServer,
    serveByPath: new Map([
      ["/api/lamp", ({ webSocket }) => {
        serveKsockSocket({
          webSocket,
          settings: lampKsockSettings,
          timers: systemTimers,
          application: createLampServerApplication({ backend: lampBackend })
        });
      }]
    ])
  });

  const close = async () => {
    lampBackend.stop();
    webSockets.close();

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
