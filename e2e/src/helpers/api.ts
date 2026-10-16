import { apiKey, urls } from "../env";

export function apiAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "x-api-key": apiKey(),
    accept: "application/json",
    ...extra,
  };
}

export function apiUrl(path: string): string {
  const base = urls.api.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
