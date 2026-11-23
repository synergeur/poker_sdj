import assert from "node:assert/strict";
import test from "node:test";

import { expiredAuthCookieHeaders } from "./sign-out-cookies.ts";

test("sign-out expires the host cookie and the shared parent cookie", () => {
  const headers = expiredAuthCookieHeaders("sb-ref-auth-token.0=abc; locale=fr", "localhost");

  assert.ok(headers.includes("sb-ref-auth-token=; Path=/; Max-Age=0; SameSite=Lax"));
  assert.ok(headers.includes("sb-ref-auth-token=; Path=/; Domain=localhost; Max-Age=0; SameSite=Lax"));
  assert.equal(headers.some((header) => header.startsWith("locale=")), false);
});
