import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { defaultResolveImportPath, type TResolveImportPathFunc } from "wurzel";

/*
 * Some packages resolve to a build the browser cannot load, e.g. an ES module reading process.env.NODE_ENV, which a
 * bundler would replace. The frontend imports their bare specifiers and wurzel rewrites them to these ES module
 * builds, so no bundler is needed.
 */
const browserBuildsBySpecifier = new Map([
  ["immer", nodePath.join(nodePath.dirname(fileURLToPath(import.meta.resolve("immer"))), "immer.production.mjs")],
  // node resolves bson to its build for node, the browser needs the one for browsers
  ["bson", nodePath.join(nodePath.dirname(fileURLToPath(import.meta.resolve("bson"))), "bson.mjs")],
]);

const resolveImportPath: TResolveImportPathFunc = async ({ importer, specifier }) => {
  const browserBuild = browserBuildsBySpecifier.get(specifier);

  if (browserBuild !== undefined) {
    return {
      error: undefined,
      filePath: browserBuild
    };
  }

  return defaultResolveImportPath({ importer, specifier });
};

export {
  resolveImportPath
};
