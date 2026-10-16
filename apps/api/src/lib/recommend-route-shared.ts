import { handleOptions } from "./route";
import { assertValidMccField, readJsonObject } from "./recommend-request";

export function recommendationRouteOptions(request: Request) {
  return handleOptions(request);
}

export async function readRecommendationBody(request: Request) {
  const raw = await readJsonObject(request);
  assertValidMccField(raw);
  return raw;
}
