/** True only when the request's Origin header is exactly the console's origin. */
export function isAllowedOrigin(originHeader: string | null, expectedOrigin: string): boolean {
  if (!originHeader || originHeader === "null") return false;
  try {
    return new URL(originHeader).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}
