import { describe, expect, it } from "vitest";
import {
  registrationSchema,
  authorizationSchema,
  encrypt,
  decrypt,
  digest,
  gatewayScopes,
} from "./security";
describe("MCP gateway boundaries", () => {
  it("advertises tracking permissions without identity scopes", () => {
    expect(gatewayScopes).toEqual(["tracking:read", "tracking:write"]);
  });
  it("accepts public clients with exact HTTPS or loopback callbacks", () => {
    expect(
      registrationSchema.safeParse({
        redirect_uris: [
          "https://chatgpt.com/connector/oauth/example",
          "http://localhost:8787/callback",
        ],
        token_endpoint_auth_method: "none",
      }).success,
    ).toBe(true);
    for (const uri of [
      "http://evil.example/callback",
      "https://example.com/cb#fragment",
      "https://user:pass@example.com/cb",
      "javascript:alert(1)",
    ]) {
      expect(
        registrationSchema.safeParse({ redirect_uris: [uri] }).success,
      ).toBe(false);
    }
  });
  it("requires S256 and rejects identity scopes and duplicated request values", () => {
    const valid = {
      client_id: crypto.randomUUID(),
      redirect_uri: "https://chatgpt.com/cb",
      response_type: "code",
      code_challenge: "a".repeat(43),
      code_challenge_method: "S256",
      scope: "tracking:read tracking:write",
      resource: "https://example.com/mcp",
      state: "state",
    };
    expect(authorizationSchema.safeParse(valid).success).toBe(true);
    for (const patch of [
      { code_challenge_method: "plain" },
      { scope: "openid email offline_access" },
      { code_challenge: "short" },
      { client_id: [valid.client_id, valid.client_id] },
    ])
      expect(
        authorizationSchema.safeParse({ ...valid, ...patch }).success,
      ).toBe(false);
  });
  it("encrypts credentials with authenticated encryption and detects tampering", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const sealed = encrypt(
      { access_token: "secret", refresh_token: "refresh" },
      key,
    );
    expect(sealed).not.toContain("secret");
    expect(decrypt(sealed, key)).toEqual({
      access_token: "secret",
      refresh_token: "refresh",
    });
    expect(() => decrypt(sealed.slice(0, -5) + "xxxxx", key)).toThrow();
    expect(() =>
      decrypt(sealed, Buffer.alloc(32, 8).toString("base64")),
    ).toThrow();
    expect(() => encrypt({}, "bad-key")).toThrow();
    expect(digest("secret")).not.toBe("secret");
    expect(digest("secret")).toBe(digest("secret"));
  });
});
