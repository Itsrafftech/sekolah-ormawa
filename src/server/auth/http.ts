import "server-only";

import { auth } from "@/lib/auth";
import { getServerEnvironment } from "@/lib/env";

export async function callInternalAuth(
  pathname: string,
  sourceHeaders: Headers,
  body?: unknown,
): Promise<Response> {
  const environment = getServerEnvironment();
  const headers = new Headers(sourceHeaders);
  headers.set("content-type", "application/json");
  headers.set("origin", new URL(environment.NEXT_PUBLIC_APP_URL).origin);
  return auth.handler(new Request(new URL(`/api/auth${pathname}`, environment.NEXT_PUBLIC_APP_URL), {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

export function copySetCookie(source: Headers, target: Headers): void {
  const values = typeof source.getSetCookie === "function"
    ? source.getSetCookie()
    : source.get("set-cookie") ? [source.get("set-cookie") as string] : [];
  for (const value of values) target.append("set-cookie", value);
}

export function noStoreJson(
  body: unknown,
  status = 200,
  sourceHeaders?: Headers,
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (sourceHeaders) copySetCookie(sourceHeaders, headers);
  return new Response(JSON.stringify(body), { status, headers });
}

