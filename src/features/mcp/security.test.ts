import { describe, expect, it } from "vitest";
import {
  validMcpClaims,
  consentReturnPath,
  supportedMcpScope,
} from "./security";
const resource = "https://mini-habitify.example/mcp";
const issuer = "https://project.supabase.co/auth/v1";
const claims = {
  iss: issuer,
  aud: ["authenticated", resource],
  sub: "11111111-1111-4111-8111-111111111111",
  client_id: "22222222-2222-4222-8222-222222222222",
  mcp_grant_id: "33333333-3333-4333-8333-333333333333",
  session_id: "33333333-3333-4333-8333-333333333333",
  role: "authenticated",
  exp: 2000,
};
describe("MCP token boundary", () => {
  it("accepts an unexpired OAuth token bound to this resource", () => {
    expect(validMcpClaims(claims, issuer, resource, 1000)).toBe(true);
  });
  it.each([
    { aud: "authenticated" },
    { iss: "https://other.example/auth/v1" },
    { client_id: undefined },
    { mcp_grant_id: undefined },
    { exp: 999 },
    { session_id: "44444444-4444-4444-8444-444444444444" },
    { role: "service_role" },
    { sub: "bad" },
  ])("rejects invalid token claims %j", (patch) => {
    expect(
      validMcpClaims({ ...claims, ...patch }, issuer, resource, 1000),
    ).toBe(false);
  });
  it("only preserves a valid consent request through login", () => {
    expect(consentReturnPath("a".repeat(32))).toBe(
      `/oauth/consent?authorization_id=${"a".repeat(32)}`,
    );
    expect(consentReturnPath("https://evil.example")).toBe("/today");
    expect(consentReturnPath(undefined)).toBe("/today");
  });
});

it("only allows the tested OAuth scope, without OIDC identity tokens", () => {
  expect(supportedMcpScope("email")).toBe(true);
  expect(supportedMcpScope("openid email")).toBe(false);
  expect(supportedMcpScope("profile")).toBe(false);
  expect(supportedMcpScope("")).toBe(false);
});
