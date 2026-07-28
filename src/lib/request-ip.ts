import type { NextRequest } from "next/server";

/** NextRequest has no built-in `.ip` — read the proxy header directly. */
export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}
