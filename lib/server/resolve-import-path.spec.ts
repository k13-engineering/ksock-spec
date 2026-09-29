import assert from "node:assert";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "mocha";
import { resolveImportPath } from "./resolve-import-path.ts";

const importer = fileURLToPath(import.meta.url);
const packageFolder = nodePath.resolve(nodePath.dirname(importer), "../..");

describe("resolve import path", () => {
  it("should resolve immer to its ES module build without process.env", async () => {
    const result = await resolveImportPath({ importer, specifier: "immer" });

    assert.deepStrictEqual(result, {
      error: undefined,
      filePath: nodePath.join(packageFolder, "node_modules/immer/dist/immer.production.mjs")
    });
  });

  it("should resolve other imports like node does", async () => {
    const result = await resolveImportPath({ importer, specifier: "./index.ts" });

    assert.deepStrictEqual(result, {
      error: undefined,
      filePath: nodePath.join(packageFolder, "lib/server/index.ts")
    });
  });

  it("should report imports that cannot be resolved", async () => {
    const result = await resolveImportPath({ importer, specifier: "does-not-exist" });

    assert.ok(result.error instanceof Error);
  });
});
