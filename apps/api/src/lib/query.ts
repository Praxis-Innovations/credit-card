import { ApiError } from "./errors";

export function parseLimitOffset(
  searchParams: URLSearchParams,
  defaults: { limit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const maxLimit = defaults.maxLimit ?? 200;
  const defaultLimit = defaults.limit ?? 100;

  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");

  let limit = defaultLimit;
  if (limitRaw !== null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > maxLimit) {
      throw new ApiError(
        400,
        "bad_request",
        `limit must be an integer between 1 and ${maxLimit}`,
      );
    }
    limit = n;
  }

  let offset = 0;
  if (offsetRaw !== null) {
    const n = Number(offsetRaw);
    if (!Number.isInteger(n) || n < 0) {
      throw new ApiError(
        400,
        "bad_request",
        "offset must be an integer >= 0",
      );
    }
    offset = n;
  }

  return { limit, offset };
}

export function optionalString(
  searchParams: URLSearchParams,
  key: string,
): string | undefined {
  const v = searchParams.get(key);
  if (v === null || v === "") return undefined;
  return v;
}

export function optionalNumber(
  searchParams: URLSearchParams,
  key: string,
): number | undefined {
  const v = searchParams.get(key);
  if (v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new ApiError(400, "bad_request", `${key} must be a number`);
  }
  return n;
}
