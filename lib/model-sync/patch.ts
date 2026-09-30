import { applyPatches, enablePatches, type Patch } from "immer";
import { isRecord } from "../ksock/parsers.ts";

enablePatches();

// the operations of JSON Patch that the difference of two models yields
type TPatchOperation = { op: "add" | "replace", path: string, value: unknown } | { op: "remove", path: string };

const hasValue = ({ operation }: { operation: Record<string, unknown> }) => {
  return ["add", "replace"].includes(operation.op as string) && Object.hasOwn(operation, "value");
};

const isPatchOperation = (raw: unknown): raw is TPatchOperation => {
  return isRecord(raw) && typeof raw.path === "string" && (raw.op === "remove" || hasValue({ operation: raw }));
};

// a json pointer, e.g. /lamp/on, as the path immer takes, in which ~1 stands for / and ~0 for ~
const pathOf = ({ pointer }: { pointer: string }) => {
  return pointer.split("/").slice(1).map((part) => {
    return part.replaceAll("~1", "/").replaceAll("~0", "~");
  });
};

/*
 * The document a patch makes of another one, frozen, sharing what the patch did not change with the one before, so an
 * unchanged part stays the same object (3.2).
 */
const applyPatch = ({ document, patch }: { document: object, patch: TPatchOperation[] }): unknown => {
  return applyPatches(document, patch.map((operation): Patch => {
    return { ...operation, path: pathOf({ pointer: operation.path }) };
  }));
};

export {
  applyPatch,
  isPatchOperation
};

export type {
  TPatchOperation
};
