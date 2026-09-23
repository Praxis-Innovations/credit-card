import { jsonResponse, optionsResponse } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export function GET(request: Request) {
  return jsonResponse(
    {
      status: "ok",
      service: "northtap-api",
      version: "0.1.0",
      time: new Date().toISOString(),
    },
    { request },
  );
}
