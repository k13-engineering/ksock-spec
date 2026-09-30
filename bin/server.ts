import nodePath from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startServer } from "../lib/index.ts";

const currentFolderPath = nodePath.dirname(fileURLToPath(import.meta.url));
const frontendFolder = nodePath.resolve(currentFolderPath, "../frontend");

const { port } = await startServer({
  frontendFolder,
  port: Number(process.env.PORT ?? 9010),
  lampDelayMs: 1500
});

console.log(`listening on http://localhost:${port}`);
