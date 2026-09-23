import { NextResponse } from "next/server";
import { errorBody, type ApiError, type ErrorCode } from "./errors";

const DEFAULT_ORIGIN = "*";

export function corsHeaders(request?: Request): HeadersInit {
  const configured =
    process.env.NORTHTAP_CORS_ORIGIN?.trim() || DEFAULT_ORIGIN;
  const requestOrigin = request?.headers.get("origin");
  const allowOrigin =
    configured === "*"
      ? "*"
      : requestOrigin &&
          configured.split(",").map((s) => s.trim()).includes(requestOrigin)
        ? requestOrigin
        : configured.split(",")[0]?.trim() || DEFAULT_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Api-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(
  data: unknown,
  init: { status?: number; headers?: HeadersInit; request?: Request } = {},
): NextResponse {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: {
      ...corsHeaders(init.request),
      ...init.headers,
    },
  });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  options: {
    details?: Record<string, unknown>;
    request?: Request;
    headers?: HeadersInit;
  } = {},
): NextResponse {
  return jsonResponse(errorBody(code, message, options.details), {
    status,
    request: options.request,
    headers: options.headers,
  });
}

export function fromApiError(
  err: ApiError,
  request?: Request,
): NextResponse {
  return errorResponse(err.status, err.code, err.message, {
    details: err.details,
    request,
  });
}

export function optionsResponse(request?: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
