import { expect, it } from "vitest";
import { gatewayDatabaseConfig } from "./database";
it("verifies hosted Supabase TLS with its CA and prevents URL SSL options overriding it", () => {
  const config = gatewayDatabaseConfig(
    "postgresql://mcp_gateway.project:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
  );
  expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
  expect(config.ssl && config.ssl.ca).toContain("-----BEGIN CERTIFICATE-----");
  expect(new URL(config.connectionString).searchParams.has("sslmode")).toBe(
    false,
  );
});
it("keeps local Supabase connections compatible without requiring TLS", () => {
  const config = gatewayDatabaseConfig(
    "postgresql://mcp_gateway:password@127.0.0.1:54322/postgres",
  );
  expect(config.ssl).toBeUndefined();
});
