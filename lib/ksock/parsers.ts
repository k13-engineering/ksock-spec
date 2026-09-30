import type { TObjectParser } from "@k13engineering/yajrpc";

const isRecord = (raw: unknown): raw is Record<string, unknown> => {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
};

// bson reads int32, int64 and double as numbers
const isCount = (value: unknown): value is number => {
  return Number.isSafeInteger(value) && (value as number) >= 0;
};

// takes the parameters as they are, if they are valid
const createParser = <T>(isValid: (raw: unknown) => raw is T): TObjectParser<T> => {
  return {
    parse: ({ raw }) => {
      return isValid(raw)
        ? { error: undefined, value: raw }
        : { error: Error("invalid parameters"), value: undefined };
    },

    format: ({ value }) => {
      return value;
    }
  };
};

// for a notification or request without parameters, whose params are left out, which bson does for undefined
const noParamsParser: TObjectParser<void> = {
  parse: ({ raw }) => {
    return raw === undefined
      ? { error: undefined, value: undefined }
      : { error: Error("unexpected parameters"), value: undefined };
  },

  format: () => {
    return undefined;
  }
};

export {
  createParser,
  isCount,
  isRecord,
  noParamsParser
};
