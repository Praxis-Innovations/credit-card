import type { CreditCard } from "@northtap/core";
import type {
  ApiErrorBody,
  RecommendationRequest,
  RecommendationResponse,
} from "./api-types";

function apiBaseUrl(): string {
  const base =
    process.env.EXPO_PUBLIC_NORTHTAP_API_URL?.trim() ||
    "http://localhost:8787";
  return base.replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.EXPO_PUBLIC_NORTHTAP_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "EXPO_PUBLIC_NORTHTAP_API_KEY is not set. Copy apps/mobile/.env.example.",
    );
  }
  return key;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", apiKey());
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const err = parsed as ApiErrorBody | null;
    const message =
      err?.error?.message ?? `API ${res.status} for ${path}`;
    const error = new Error(message) as Error & {
      status: number;
      code?: string;
    };
    error.status = res.status;
    error.code = err?.error?.code;
    throw error;
  }

  return parsed as T;
}

export interface CardListResponse {
  data: CreditCard[];
  meta: { total: number; limit: number; offset: number };
}

/** Fetch the verified card catalog from apps/api (paginated). */
export async function fetchCards(options?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<CardListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 200));
  params.set("offset", String(options?.offset ?? 0));
  if (options?.q) params.set("q", options.q);
  return apiFetch<CardListResponse>(`/v1/cards?${params.toString()}`);
}

/** Load the full catalog (follows pagination until exhausted). */
export async function fetchAllCards(): Promise<CreditCard[]> {
  const pageSize = 200;
  let offset = 0;
  const all: CreditCard[] = [];
  for (;;) {
    const page = await fetchCards({ limit: pageSize, offset });
    all.push(...page.data);
    offset += page.data.length;
    if (offset >= page.meta.total || page.data.length === 0) break;
  }
  return all;
}

export async function fetchRecommendation(
  body: RecommendationRequest,
): Promise<RecommendationResponse> {
  return apiFetch<RecommendationResponse>("/v1/recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
